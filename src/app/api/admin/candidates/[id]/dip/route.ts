import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";
import { syncCandidateDipEnvelopeState } from "@/lib/services/docusign-sync";
import { getDipTemplateDocuments, getDipTemplateSettings } from "@/lib/services/dip-template";

async function trySyncCandidateDipEnvelopeState(candidateId: string) {
  await Promise.race([
    syncCandidateDipEnvelopeState(candidateId),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))
  ]).catch(() => null);
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  await trySyncCandidateDipEnvelopeState(params.id);

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      documents: {
        where: {
          type: { in: ["dip", "elm", "dip_annex"] }
        },
        orderBy: { uploadedAt: "desc" }
      },
      eventLogs: {
        where: {
          actionType: { in: ["DIP_PREPARATION_UPDATED", "DIP_PREPARATION_FROZEN"] }
        },
        orderBy: { createdAt: "desc" }
      },
      docusignEnvelopes: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });
  }

  const [templateSettings, templateDocuments] = await Promise.all([
    getDipTemplateSettings(),
    getDipTemplateDocuments()
  ]);

  const frozenLog = candidate.eventLogs.find((log) => log.actionType === "DIP_PREPARATION_FROZEN");
  const latestDraft = candidate.eventLogs.find((log) => log.actionType === "DIP_PREPARATION_UPDATED");
  const draftData =
    ((frozenLog?.detailsJson as Record<string, unknown> | undefined) ??
      (latestDraft?.detailsJson as Record<string, unknown> | undefined) ??
      {}) as {
      version?: string;
    };

  const elmFiles = candidate.documents.filter((document) => document.type === "elm");

  return NextResponse.json({
    candidate: {
      id: candidate.id,
      firstname: candidate.user.firstname,
      lastname: candidate.user.lastname,
      email: candidate.user.email,
      currentStep: candidate.currentStep,
      projectZone: candidate.projectZone || candidate.city || "",
      projectZipcode: candidate.zipcode || ""
    },
    frozenAt: frozenLog?.createdAt.toISOString() ?? null,
    sentEnvelopeId:
      candidate.docusignEnvelopes.find((envelope) =>
        ["SENT", "DELIVERED", "COMPLETED"].includes(envelope.status)
      )?.envelopeId ?? null,
    version: String(draftData.version ?? templateSettings.version),
    docusignTemplateId: templateSettings.docusignTemplateId,
    docusignTemplateRoleName: templateSettings.docusignTemplateRoleName,
    mainDipDocument: templateDocuments.mainDocument
      ? {
          id: templateDocuments.mainDocument.id,
          fileName: templateDocuments.mainDocument.fileName,
          fileUrl: templateDocuments.mainDocument.fileUrl,
          mimeType: templateDocuments.mainDocument.mimeType,
          uploadedAt: templateDocuments.mainDocument.uploadedAt.toISOString()
        }
      : null,
    templateAnnexes: templateDocuments.annexes.map((document) => ({
      id: document.id,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      mimeType: document.mimeType,
      uploadedAt: document.uploadedAt.toISOString()
    })),
    elmFiles: elmFiles.map((document) => ({
        id: document.id,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        mimeType: document.mimeType,
        uploadedAt: document.uploadedAt.toISOString()
      }))
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const body = (await request.json().catch(() => null)) as
    | {
        version?: string;
        freeze?: boolean;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      documents: { where: { type: { in: ["elm"] } } },
      eventLogs: {
        where: {
          actionType: "DIP_PREPARATION_FROZEN"
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });
  }

  if (candidate.eventLogs.length) {
    return NextResponse.json({ error: "Le DIP validé est figé et ne peut plus être modifié." }, { status: 409 });
  }

  const elmFiles = candidate.documents.filter((document) => document.type === "elm");
  const templateDocuments = await getDipTemplateDocuments();
  const templateSettings = await getDipTemplateSettings();

  if (body.freeze && !templateSettings.docusignTemplateId.trim()) {
    return NextResponse.json({ error: "Merci de renseigner l’identifiant du modèle DocuSign dans le workflow." }, { status: 400 });
  }

  if (body.freeze && !templateSettings.docusignTemplateRoleName.trim()) {
    return NextResponse.json({ error: "Merci de renseigner le nom du rôle signataire DocuSign dans le workflow." }, { status: 400 });
  }

  if (body.freeze && !templateDocuments.mainDocument) {
    return NextResponse.json({ error: "Merci d’uploader le DIP principal PDF dans le workflow." }, { status: 400 });
  }

  if (body.freeze && elmFiles.length === 0) {
    return NextResponse.json({ error: "Au moins un ELM candidat est requis avant validation du DIP." }, { status: 400 });
  }

  await logEvent({
    actionType: body.freeze ? "DIP_PREPARATION_FROZEN" : "DIP_PREPARATION_UPDATED",
    candidateId: candidate.id,
    userId: session.user.id,
    detailsJson: {
      version: body.version?.trim() || "2026.1",
      docusignTemplateId: templateSettings.docusignTemplateId,
      docusignTemplateRoleName: templateSettings.docusignTemplateRoleName,
      mainDipDocumentId: templateDocuments.mainDocument?.id ?? null,
      templateAnnexIds: templateDocuments.annexes.map((file) => file.id),
      selectedElmIds: elmFiles.map((file) => file.id),
      frozenAt: body.freeze ? new Date().toISOString() : null
    }
  });

  return NextResponse.json({ success: true });
}
