import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { autoAdvanceCandidateFromStep7 } from "@/lib/services/candidate-step-rules";
import { logEvent } from "@/lib/services/event-log";

const STEP_BY_TYPE: Record<string, number> = {
  plans_local: 6,
  photos_local: 6,
  business_plan: 6,
  kbis: 6,
  statuts: 6,
  carte_identite: 6,
  justificatif_domicile: 6,
  rib_societe: 6,
  devis_menuisier_signe: 9
};

const MULTI_FILE_TYPES = new Set(["plans_local", "photos_local"]);

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const formData = await request.formData();
  const file = formData.get("file");
  const type = String(formData.get("type") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  if (!type || !(type in STEP_BY_TYPE)) {
    return NextResponse.json({ error: "Type de document invalide." }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: { onboardingToken: params.token },
    include: { user: true }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Lien candidat invalide." }, { status: 404 });
  }

  if (candidate.currentStep < STEP_BY_TYPE[type]) {
    return NextResponse.json({ error: "Ce document n'est pas encore attendu à cette étape." }, { status: 403 });
  }

  const fileUrl = await fileToDataUrl(file);

  if (!MULTI_FILE_TYPES.has(type)) {
    await prisma.document.deleteMany({
      where: {
        candidateId: candidate.id,
        type
      }
    });
  }

  const document = await prisma.document.create({
    data: {
      candidateId: candidate.id,
      stepNumber: STEP_BY_TYPE[type],
      type,
      fileUrl,
      fileName: file.name,
      mimeType: file.type,
      uploadedById: candidate.user.id
    }
  });

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: { lastActivityAt: new Date() }
  });

  await logEvent({
    actionType: "CANDIDATE_DOCUMENT_UPDATED",
    candidateId: candidate.id,
    userId: candidate.user.id,
    detailsJson: { type, fileName: file.name, source: "candidate-portal" }
  });

  await autoAdvanceCandidateFromStep7(candidate.id, candidate.user.id);

  return NextResponse.json({
    success: true,
    document: {
      id: document.id,
      type: document.type,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      mimeType: document.mimeType,
      uploadedAt: document.uploadedAt.toISOString()
    }
  });
}
