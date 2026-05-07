import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiRole } from "@/lib/auth/api";
import { createEnvelope } from "@/lib/integrations/docusign";

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV", "CANDIDATE"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const body = await request.json();
  const candidateId = String(body.candidateId);
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { user: true }
  });

  if (session.user.role === "CANDIDATE" && candidate.userId !== session.user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const envelope = await createEnvelope({
    candidateEmail: candidate.user.email,
    candidateName: `${candidate.user.firstname} ${candidate.user.lastname}`,
    stepNumber: Number(body.stepNumber),
    documentBase64: String(body.documentBase64 ?? ""),
    fileName: String(body.fileName ?? "document.pdf")
  });

  const record = await prisma.docuSignEnvelope.create({
    data: {
      candidateId: candidate.id,
      stepNumber: Number(body.stepNumber),
      envelopeId: envelope.envelopeId,
      status: "SENT"
    }
  });

  return NextResponse.json(record);
}

export async function GET() {
  return NextResponse.json({
    message: "Utilisez POST pour créer une enveloppe DocuSign."
  });
}
