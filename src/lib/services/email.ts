import nodemailer from "nodemailer";
import { Resend } from "resend";
import { prisma } from "@/lib/db/prisma";
import { buildDefaultSignature, getAppSettings, resolveUserProfile } from "@/lib/services/settings-store";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const DEFAULT_TEMPLATES: Record<
  string,
  {
    subject: string;
    bodyText: string;
    bodyHtml: string;
  }
> = {
  "candidate-application-invitation": {
    subject: "Suite à votre prise de contact pour la franchise {{brandName}}",
    bodyText:
      "Bonjour {{firstname}},\n\nMerci d'avoir pris contact avec nous concernant le projet de franchise {{brandName}}.\n\nVous trouverez en piece jointe la plaquette de presentation de la franchise, c'est toujours utile.\n\nPour planifier une visio ensemble, il va me falloir quelques informations supplementaires. Il vous suffit de les remplir en suivant ce lien : {{applicationUrl}}\n\nDes qu'il est rempli, vous recevrez un acces a mon agenda pour que vous choisissiez un creneau pour la visio.\n\nAu plaisir !",
    bodyHtml:
      "<p>Bonjour {{firstname}},</p><p>Merci d'avoir pris contact avec nous concernant le projet de franchise {{brandName}}.</p><p>Vous trouverez en piece jointe la plaquette de presentation de la franchise, c'est toujours utile.</p><p>Pour planifier une visio ensemble, il va me falloir quelques informations supplementaires. Il vous suffit de les remplir en suivant ce lien : <a href='{{applicationUrl}}'>Completer mon dossier</a></p><p>Des qu'il est rempli, vous recevrez un acces a mon agenda pour que vous choisissiez un creneau pour la visio.</p><p>Au plaisir !</p>"
  },
  "candidate-application-visio": {
    subject: "Votre dossier est complet, planifions notre visio {{brandName}}",
    bodyText:
      "Bonjour {{firstname}},\n\nMerci d'avoir pris le temps de completer votre dossier de candidature pour la franchise {{brandName}}.\n\nJe vous invite maintenant a reserver le creneau de visio qui vous convient en suivant ce lien : {{bookingUrl}}\n\nCette visio nous permettra d'echanger sur votre projet et de repondre a vos questions.\n\nAu plaisir !",
    bodyHtml:
      "<p>Bonjour {{firstname}},</p><p>Merci d'avoir pris le temps de completer votre dossier de candidature pour la franchise {{brandName}}.</p><p>Je vous invite maintenant a reserver le creneau de visio qui vous convient en suivant ce lien : <a href='{{bookingUrl}}'>Reserver ma visio</a></p><p>Cette visio nous permettra d'echanger sur votre projet et de repondre a vos questions.</p><p>Au plaisir !</p>"
  },
  "candidate-discovery-invitation": {
    subject: "Réservons votre journée découverte {{brandName}}",
    bodyText:
      "Bonjour {{firstname}},\n\nMerci pour notre échange visio.\n\nJe vous propose maintenant de réserver votre journée découverte en suivant ce lien : {{bookingUrl}}\n\nÀ très vite !",
    bodyHtml:
      "<p>Bonjour {{firstname}},</p><p>Merci pour notre échange visio.</p><p>Je vous propose maintenant de réserver votre journée découverte en suivant ce lien : <a href='{{bookingUrl}}'>Réserver ma journée découverte</a></p><p>À très vite !</p>"
  },
  "candidate-discovery-feedback": {
    subject: "Merci pour votre venue chez {{brandName}}",
    bodyText:
      "Bonjour {{firstname}},\n\nMerci d'être venu à votre journée découverte hier.\n\nPour la suite du parcours, merci de remplir ce court retour : {{feedbackUrl}}\n\nAu plaisir !",
    bodyHtml:
      "<p>Bonjour {{firstname}},</p><p>Merci d'être venu à votre journée découverte hier.</p><p>Pour la suite du parcours, merci de remplir ce court retour : <a href='{{feedbackUrl}}'>Remplir mon retour</a></p><p>Au plaisir !</p>"
  },
  "mapping-manager-notification": {
    subject: "Nouveau candidat à contacter pour le mapping {{brandName}}",
    bodyText:
      "Bonjour {{mappingManagerFirstname}},\n\nLe candidat {{candidateFullName}} va vous contacter pour échanger sur son projet de franchise pour la zone de {{projectZone}} {{projectZipcode}}.\n\nVoici ses coordonnées :\n{{candidateEmail}}\n{{candidatePhone}}\n\nVous pouvez le joindre au {{mappingManagerPhone}}.",
    bodyHtml:
      "<p>Bonjour {{mappingManagerFirstname}},</p><p>Le candidat <strong>{{candidateFullName}}</strong> va vous contacter pour échanger sur son projet de franchise pour la zone de <strong>{{projectZone}} {{projectZipcode}}</strong>.</p><p>Voici ses coordonnées :</p><p>{{candidateEmail}}<br/>{{candidatePhone}}</p><p>Vous pouvez le joindre au {{mappingManagerPhone}}.</p>"
  },
  "dip-ready-notification": {
    subject: "Le DIP de {{candidateFullName}} pour {{projectZone}} est prêt à être envoyé",
    bodyText:
      "Bonjour {{firstname}},\n\nLe DIP de {{candidateFullName}} pour {{projectZone}} est prêt à être envoyé.\n\nVous pouvez le relire, le compléter et le valider ici : {{dipPreparationUrl}}\n\nLes ELM du candidat y sont déjà rattachés en annexe.\n\nUne fois validé, le DIP préparé sera figé et ne devra plus être modifié avant l'envoi DocuSign.",
    bodyHtml:
      "<p>Bonjour {{firstname}},</p><p>Le DIP de <strong>{{candidateFullName}}</strong> pour <strong>{{projectZone}}</strong> est prêt à être envoyé.</p><p>Vous pouvez le relire, le compléter et le valider ici : <a href='{{dipPreparationUrl}}'>Ouvrir la préparation du DIP</a></p><p>Les ELM du candidat y sont déjà rattachés en annexe.</p><p>Une fois validé, le DIP préparé sera figé et ne devra plus être modifié avant l'envoi DocuSign.</p>"
  },
  "candidate-local-project-opened": {
    subject: "Votre espace candidat {{brandName}} a été mis à jour",
    bodyText:
      "Bonjour {{firstname}},\n\nLe délai légal lié au DIP est maintenant terminé.\n\nVotre espace a été mis à jour afin de télécharger les différents éléments permettant d’étudier l’ouverture de votre agence {{brandName}}.\n\nVous pouvez y déposer vos projets de locaux, vos plans, votre business plan et vos premières pièces société.\n\nÀ très vite !",
    bodyHtml:
      "<p>Bonjour {{firstname}},</p><p>Le délai légal lié au DIP est maintenant terminé.</p><p>Votre espace a été mis à jour afin de télécharger les différents éléments permettant d’étudier l’ouverture de votre agence <strong>{{brandName}}</strong>.</p><p>Vous pouvez y déposer vos projets de locaux, vos plans, votre business plan et vos premières pièces société.</p><p>À très vite !</p>"
  }
};

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

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function textToHtml(text: string) {
  const escaped = escapeHtml(text);

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) =>
      `<p style="margin:0 0 16px 0;">${paragraph
        .replaceAll("{{applicationUrl}}", `<a href="{{applicationUrl}}" style="color:#007cbd;text-decoration:none;">{{applicationUrl}}</a>`)
        .replaceAll("{{bookingUrl}}", `<a href="{{bookingUrl}}" style="color:#007cbd;text-decoration:none;">{{bookingUrl}}</a>`)
        .replaceAll("{{feedbackUrl}}", `<a href="{{feedbackUrl}}" style="color:#007cbd;text-decoration:none;">{{feedbackUrl}}</a>`)
        .replaceAll("{{mappingPortalUrl}}", `<a href="{{mappingPortalUrl}}" style="color:#007cbd;text-decoration:none;">{{mappingPortalUrl}}</a>`)
        .replaceAll("{{dipPreparationUrl}}", `<a href="{{dipPreparationUrl}}" style="color:#007cbd;text-decoration:none;">{{dipPreparationUrl}}</a>`)
        .replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
}

function buildSignatureHtml(params: {
  firstname: string;
  lastname: string;
  professionalRole: string;
  professionalEmail: string;
  professionalPhone: string;
  brandName: string;
  photoDataUrl: string;
}) {
  const fullName = `${params.firstname} ${params.lastname}`.trim();
  const initials = `${params.firstname?.[0] ?? ""}${params.lastname?.[0] ?? ""}`.toUpperCase();
  const safeName = escapeHtml(fullName);
  const safeRole = escapeHtml(params.professionalRole);
  const safeEmail = escapeHtml(params.professionalEmail);
  const safePhone = escapeHtml(params.professionalPhone);
  const safeBrand = escapeHtml(params.brandName);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;padding-right:16px;">
          <div style="width:72px;height:72px;border-radius:18px;background:#007cbd;color:#ffffff;font-family:Arial,sans-serif;font-size:24px;font-weight:700;line-height:72px;text-align:center;">${initials || "A"}</div>
        </td>
        <td style="width:1px;background:#d7e9f4;"></td>
        <td style="vertical-align:top;padding-left:16px;font-family:Arial,sans-serif;">
          <div style="font-size:18px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#0f172a;margin:0 0 3px 0;">${safeName}</div>
          ${safeRole ? `<div style="font-size:12px;font-style:italic;color:#64748b;margin:0 0 8px 0;">${safeRole}</div>` : ""}
          <div style="display:inline-block;height:2px;width:44px;background:#007cbd;border-radius:999px;margin:0 0 10px 0;"></div>
          <div style="font-size:12px;color:#0f172a;line-height:1.75;">
            <div style="margin:0 0 2px 0;"><span style="display:inline-block;width:16px;color:#007cbd;">✉</span> ${safeEmail}</div>
            ${safePhone ? `<div style="margin:0 0 2px 0;"><span style="display:inline-block;width:16px;color:#007cbd;">☎</span> ${safePhone}</div>` : ""}
            <div><span style="display:inline-block;width:16px;color:#007cbd;">◆</span> ${safeBrand}</div>
          </div>
        </td>
      </tr>
    </table>
  `;
}

function normalizeTemplateContent(templateSlug: string, content: string, type: "subject" | "text" | "html") {
  if (!["candidate-application-invitation", "candidate-application-visio"].includes(templateSlug)) {
    return content;
  }

  let next = content.replaceAll("Zonara", "{{brandName}}").replaceAll("Atome3D", "{{brandName}}");

  if (type === "text") {
    next = next.replace(/\n\s*L'équipe\s+\{\{brandName\}\}\s*$/i, "");
    next = next.replace(/\n\s*L'équipe\s+[^\n]+\s*$/i, "");
  }

  if (type === "html") {
    next = next.replace(/<p>\s*L'équipe\s+\{\{brandName\}\}\s*<\/p>/gi, "");
    next = next.replace(/<p>\s*L'équipe\s+.*?<\/p>/gi, "");
  }

  return next;
}

export async function sendTemplatedEmail(params: {
  templateSlug: string;
  to: string;
  replacements?: Record<string, string>;
  candidateId?: string;
  senderUserId?: string;
  subjectOverride?: string;
  bodyTextOverride?: string;
  attachmentsOverride?: Array<{
    fileName: string;
    mimeType: string;
    fileUrl: string;
  }>;
}) {
  const [template, attachments, settings, senderUser] = await Promise.all([
    prisma.emailTemplate.findUnique({
      where: { slug: params.templateSlug }
    }),
    prisma.document.findMany({
      where: { type: `email_template_${params.templateSlug}` },
      orderBy: { uploadedAt: "desc" }
    }),
    getAppSettings(),
    params.senderUserId
      ? prisma.user.findUnique({
          where: { id: params.senderUserId }
        })
      : null
  ]);

  const fallbackTemplate = DEFAULT_TEMPLATES[params.templateSlug];

  if (!template && !fallbackTemplate) {
    throw new Error(`Template email introuvable: ${params.templateSlug}`);
  }

  if (template && !template.isActive) {
    throw new Error(`Template email inactif: ${params.templateSlug}`);
  }

  const senderName = senderUser ? `${senderUser.firstname} ${senderUser.lastname}` : settings.brandName;
  const senderProfile = senderUser
    ? resolveUserProfile({
        settings,
        user: {
          id: senderUser.id,
          firstname: senderUser.firstname,
          lastname: senderUser.lastname,
          email: senderUser.email,
          phone: senderUser.phone,
          role: senderUser.role
        }
      })
    : null;
  const senderSignature =
    senderUser && senderProfile
      ? settings.userSignatures[senderUser.id] ??
        buildDefaultSignature({
          firstname: senderProfile.firstname,
          lastname: senderProfile.lastname,
          brandName: settings.brandName,
          senderEmail: settings.senderEmail,
          professionalRole: senderProfile.professionalRole,
          professionalPhone: senderProfile.professionalPhone,
          professionalEmail: senderProfile.professionalEmail
        })
      : `${settings.brandName}\n${settings.senderEmail}`;
  const signatureHtml = senderUser && senderProfile
    ? buildSignatureHtml({
        firstname: senderProfile.firstname,
        lastname: senderProfile.lastname,
        professionalRole: senderProfile.professionalRole,
        professionalEmail: senderProfile.professionalEmail,
        professionalPhone: senderProfile.professionalPhone,
        brandName: settings.brandName,
        photoDataUrl: senderProfile.photoDataUrl
      })
    : `<p style="margin-top:24px;font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:#334155;">${senderSignature
        .split("\n")
        .filter(Boolean)
        .map((line) => line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"))
        .join("<br/>")}</p>`;

  const replacements = {
    brandName: settings.brandName,
    senderName,
    senderEmail: settings.senderEmail,
    ...params.replacements
  };
  const apply = (text: string) =>
    Object.entries(replacements).reduce(
      (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
      text
    );

  const baseSubject = normalizeTemplateContent(
    params.templateSlug,
    params.subjectOverride ?? template?.subject ?? fallbackTemplate.subject,
    "subject"
  );
  const baseText = normalizeTemplateContent(
    params.templateSlug,
    params.bodyTextOverride ?? template?.bodyText ?? fallbackTemplate.bodyText,
    "text"
  );
  // The workflow UI edits only the text body. Rebuild the HTML from that same source
  // so the email content always matches what is visible in the template editor.
  const baseHtml = textToHtml(baseText);

  const subject = apply(baseSubject);
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#0f172a;">
      ${apply(baseHtml)}
      ${signatureHtml}
    </div>
  `;
  const text = `${apply(baseText)}\n\n${senderSignature}`;

  const sourceAttachments = params.attachmentsOverride ?? attachments.map((attachment) => ({
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    fileUrl: attachment.fileUrl
  }));

  const preparedAttachments = sourceAttachments.map((attachment) => {
    const matches = attachment.fileUrl.match(/^data:(.*?);base64,(.*)$/);
    return {
      filename: attachment.fileName,
      content: matches?.[2] ?? "",
      contentType: attachment.mimeType || matches?.[1] || undefined
    };
  });

  let sent = false;

  if (resend) {
    await resend.emails.send({
      from: `${senderName} <${settings.senderEmail}>`,
      to: params.to,
      subject,
      html,
      text,
      attachments: preparedAttachments
    });
    sent = true;
  } else if (smtpTransport) {
    await smtpTransport.sendMail({
      from: `${senderName} <${settings.senderEmail}>`,
      to: params.to,
      subject,
      html,
      text,
      attachments: preparedAttachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        encoding: "base64",
        contentType: attachment.contentType
      }))
    });
    sent = true;
  }

  await prisma.emailLog.create({
    data: {
      candidateId: params.candidateId,
      templateSlug: params.templateSlug,
      to: params.to,
      subject,
      status: sent ? "SENT" : "NOT_CONFIGURED"
    }
  });
}
