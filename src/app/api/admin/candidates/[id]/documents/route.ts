import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { autoAdvanceCandidateFromStep7 } from "@/lib/services/candidate-step-rules";
import { logEvent } from "@/lib/services/event-log";

const STEP_BY_TYPE: Record<string, number> = {
  questionnaire: 2,
  cv: 2,
  retour_journee_decouverte: 4,
  elm: 5,
  dip_annex: 5,
  dip: 5,
  plans_local: 6,
  photos_local: 6,
  business_plan: 6,
  kbis: 6,
  statuts: 6,
  carte_identite: 6,
  justificatif_domicile: 6,
  rib_societe: 6,
  contrat_reservation_zone: 8,
  contrat_definitif: 8,
  plan_3d_local: 9,
  devis_menuisier: 9,
  devis_menuisier_signe: 9
};

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const documentId = request.nextUrl.searchParams.get("documentId")?.trim();

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

  return NextResponse.json({
    id: document.id,
    fileName: document.fileName,
    fileUrl: document.fileUrl,
    mimeType: document.mimeType,
    uploadedAt: document.uploadedAt.toISOString()
  });
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

  if (type === "contrat_reservation_zone" || type === "contrat_definitif") {
    const candidateContractState = await prisma.candidate.findUnique({
      where: { id: params.id },
      include: {
        docusignEnvelopes: {
          where: { stepNumber: 8 },
          orderBy: { createdAt: "desc" }
        },
        eventLogs: {
          where: { actionType: "CONTRACT_SENT_TO_DOCUSIGN" },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    const hasActiveSameTypeEnvelope = candidateContractState?.docusignEnvelopes.some((envelope) => {
      if (!["CREATED", "SENT", "DELIVERED"].includes(envelope.status)) {
        return false;
      }

      return candidateContractState.eventLogs.some((log) => {
        const details = (log.detailsJson ?? {}) as Record<string, unknown>;
        return (
          String(details.envelopeId ?? "") === envelope.envelopeId &&
          String(details.contractType ?? "") === type
        );
      });
    });

    if (hasActiveSameTypeEnvelope) {
      return NextResponse.json(
        { error: "Une signature est déjà en cours pour ce contrat." },
        { status: 409 }
      );
    }

    const existingSignedContract = await prisma.document.findFirst({
      where: {
        candidateId: params.id,
        type,
        fileName: {
          contains: "signé",
          mode: "insensitive"
        }
      }
    });

    if (existingSignedContract) {
      return NextResponse.json(
        { error: "Ce contrat a déjà été signé et ne peut plus être remplacé." },
        { status: 409 }
      );
    }

    await prisma.document.deleteMany({
      where: {
        candidateId: params.id,
        type
      }
    });
  }

  const document = await prisma.document.create({
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

  await autoAdvanceCandidateFromStep7(params.id, session.user.id);

  return NextResponse.json({
    success: true,
    document: {
      id: document.id,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      mimeType: document.mimeType,
      uploadedAt: document.uploadedAt.toISOString()
    }
  });
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

  if (
    (document.type === "contrat_reservation_zone" || document.type === "contrat_definitif") &&
    /signé/i.test(document.fileName)
  ) {
    return NextResponse.json(
      { error: "Le contrat signé ne peut plus être supprimé." },
      { status: 409 }
    );
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
