import nodemailer from "nodemailer";
import { Resend } from "resend";
import { prisma } from "@/lib/db/prisma";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function buildSmtpTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

const smtpTransport = buildSmtpTransport();

export async function sendTemplatedEmail(params: {
  templateSlug: string;
  to: string;
  replacements?: Record<string, string>;
  candidateId?: string;
}) {
  const template = await prisma.emailTemplate.findUnique({
    where: { slug: params.templateSlug }
  });

  if (!template || !template.isActive) {
    throw new Error(`Template email introuvable: ${params.templateSlug}`);
  }

  const replacements = params.replacements ?? {};
  const apply = (text: string) =>
    Object.entries(replacements).reduce(
      (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
      text
    );

  const subject = apply(template.subject);
  const html = apply(template.bodyHtml);
  const text = apply(template.bodyText);

  if (resend) {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Atome3D <noreply@atome3d.fr>",
      to: params.to,
      subject,
      html,
      text
    });
  } else if (smtpTransport) {
    await smtpTransport.sendMail({
      from: process.env.EMAIL_FROM ?? "Atome3D <noreply@atome3d.fr>",
      to: params.to,
      subject,
      html,
      text
    });
  }

  await prisma.emailLog.create({
    data: {
      candidateId: params.candidateId,
      templateSlug: params.templateSlug,
      to: params.to,
      subject,
      status: "SENT"
    }
  });
}
