import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";

const STEP_BY_TYPE: Record<string, number> = {
  questionnaire: 2,
  cv: 2,
  retour_journee_decouverte: 4,
  elm: 5,
  dip: 5,
  plans_local: 6,
  kbis: 7,
  statuts: 7,
  carte_identite: 7
};

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const formData = await request.formData();
  const file = formData.get("file");
  const type = String(formData.get("type") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  if (!type || !(type in STEP_BY_TYPE)) {
    return NextResponse.json({ error: "Type de document invalide." }, { status: 400 });
  }

  const fileUrl = await fileToDataUrl(file);
  const stepNumber = STEP_BY_TYPE[type];

  await prisma.document.create({
    data: {
      candidateId: params.id,
      stepNumber,
      type,
      fileUrl,
      fileName: file.name,
      mimeType: file.type,
      uploadedById: session.user.id
    }
  });

  await prisma.candidate.update({
    where: { id: params.id },
    data: { lastActivityAt: new Date() }
  });

  await logEvent({
    actionType: "CANDIDATE_DOCUMENT_UPDATED",
    candidateId: params.id,
    userId: session.user.id,
    detailsJson: { type, fileName: file.name }
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const body = (await request.json().catch(() => null)) as { documentId?: string } | null;
  const documentId = body?.documentId?.trim();

  if (!documentId) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      candidateId: params.id
    }
  });

  if (!document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  await prisma.document.delete({
    where: { id: documentId }
  });

  await prisma.candidate.update({
    where: { id: params.id },
    data: { lastActivityAt: new Date() }
  });

  await logEvent({
    actionType: "CANDIDATE_DOCUMENT_UPDATED",
    candidateId: params.id,
    userId: session.user.id,
    detailsJson: { type: document.type, deletedFileName: document.fileName }
  });

  return NextResponse.json({ success: true });
}
