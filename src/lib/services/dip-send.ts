import { prisma } from "@/lib/db/prisma";
import { createEnvelope, resendEnvelope } from "@/lib/integrations/docusign";
import { logEvent } from "@/lib/services/event-log";
import { getDipTemplateDocuments, getDipTemplateSettings } from "@/lib/services/dip-template";

function extractBase64FromDataUrl(value: string) {
  const match = value.match(/^data:.*?;base64,(.*)$/);
  return match?.[1] ?? "";
}

function buildElmAttachmentName(projectZone: string, index: number) {
  const suffix = projectZone.trim().length ? ` - ${projectZone.trim()}` : "";
  return index === 0
    ? `Annexe 09 - Etat Local de marché${suffix}.pdf`
    : `Annexe 09 - Etat Local de marché${suffix} (${index + 1}).pdf`;
}

function extractAnnexOrder(fileName: string) {
  const match = fileName.match(/annexe\s*0?(\d{1,2})/i) || fileName.match(/\b0?(\d{1,2})\b/);
  if (!match) return 999;
  return Number(match[1]);
}

export async function sendDipEnvelopeForCandidate(params: {
  candidateId: string;
  actorUserId: string;
  forceResend?: boolean;
}) {
  const [candidate, dipTemplateSettings, dipTemplateDocuments] = await Promise.all([
    prisma.candidate.findUniqueOrThrow({
      where: { id: params.candidateId },
      include: {
        user: true,
        documents: {
          where: {
            type: { in: ["dip", "elm"] }
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
    }),
    getDipTemplateSettings(),
    getDipTemplateDocuments()
  ]);

  const activeEnvelope = candidate.docusignEnvelopes.find((envelope) =>
    ["CREATED", "SENT", "DELIVERED"].includes(envelope.status)
  );
  if (activeEnvelope && !params.forceResend) {
    throw new Error("Une enveloppe DocuSign est déjà en cours pour ce candidat.");
  }

  if (activeEnvelope && params.forceResend) {
    const resentEnvelope = await resendEnvelope({ envelopeId: activeEnvelope.envelopeId });

    const updatedEnvelope = await prisma.docuSignEnvelope.update({
      where: { id: activeEnvelope.id },
      data: {
        status:
          resentEnvelope.status === "DELIVERED" ||
          resentEnvelope.status === "COMPLETED" ||
          resentEnvelope.status === "DECLINED" ||
          resentEnvelope.status === "VOIDED"
            ? resentEnvelope.status
            : "SENT"
      }
    });

    await logEvent({
      actionType: "DIP_SIGNATURE_RELAUNCHED",
      candidateId: candidate.id,
      userId: params.actorUserId,
      detailsJson: {
        envelopeId: updatedEnvelope.envelopeId,
        resentAt: new Date().toISOString()
      }
    });

    return updatedEnvelope;
  }

  if (!dipTemplateSettings.docusignTemplateId.trim()) {
    throw new Error("Aucun identifiant de modèle DocuSign n’est configuré dans le workflow.");
  }

  if (!dipTemplateSettings.docusignTemplateRoleName.trim()) {
    throw new Error("Aucun rôle signataire DocuSign n’est configuré dans le workflow.");
  }

  if (!dipTemplateDocuments.mainDocument) {
    throw new Error("Aucun DIP principal PDF n’est configuré dans le workflow.");
  }

  const elmDocuments = candidate.documents.filter((document) => document.type === "elm");
  if (!elmDocuments.length) {
    throw new Error("Aucun ELM candidat n'a encore été uploadé.");
  }

  const mainDipBase64 = extractBase64FromDataUrl(dipTemplateDocuments.mainDocument.fileUrl);
  if (!mainDipBase64) {
    throw new Error("Le DIP principal PDF est invalide.");
  }

  const orderedAnnexAttachments = [
    ...dipTemplateDocuments.annexes
      .sort((a, b) => {
        const orderDiff = extractAnnexOrder(a.fileName) - extractAnnexOrder(b.fileName);
        return orderDiff === 0 ? a.fileName.localeCompare(b.fileName, "fr") : orderDiff;
      })
      .map((document) => {
        const documentBase64 = extractBase64FromDataUrl(document.fileUrl);
        return documentBase64
          ? {
              documentBase64,
              fileName: document.fileName || "annexe-dip.pdf",
              order: extractAnnexOrder(document.fileName || "")
            }
          : null;
      })
      .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment)),
    ...elmDocuments
      .map((document, index) => {
        const documentBase64 = extractBase64FromDataUrl(document.fileUrl);
        return documentBase64
          ? {
              documentBase64,
              fileName: buildElmAttachmentName(candidate.projectZone || candidate.city || "", index),
              order: 9
            }
          : null;
      })
      .filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment))
  ].sort((a, b) => {
    const orderDiff = a.order - b.order;
    return orderDiff === 0 ? a.fileName.localeCompare(b.fileName, "fr") : orderDiff;
  });

  await prisma.document.deleteMany({
    where: {
      candidateId: candidate.id,
      type: "dip"
    }
  });

  await prisma.document.create({
    data: {
      candidateId: candidate.id,
      stepNumber: 5,
      type: "dip",
      fileUrl: dipTemplateDocuments.mainDocument.fileUrl,
      fileName: `DIP envoyé à la signature - ${candidate.user.firstname} ${candidate.user.lastname}.pdf`,
      mimeType: "application/pdf",
      uploadedById: params.actorUserId
    }
  });

  const lastPreparationLog = candidate.eventLogs.find((log) =>
    ["DIP_PREPARATION_FROZEN", "DIP_PREPARATION_UPDATED"].includes(log.actionType)
  );

  if (!lastPreparationLog || lastPreparationLog.actionType !== "DIP_PREPARATION_FROZEN") {
    await logEvent({
      actionType: "DIP_PREPARATION_FROZEN",
      candidateId: candidate.id,
      userId: params.actorUserId,
      detailsJson: {
        version: dipTemplateSettings.version,
        docusignTemplateId: dipTemplateSettings.docusignTemplateId,
        docusignTemplateRoleName: dipTemplateSettings.docusignTemplateRoleName,
        mainDipDocumentId: dipTemplateDocuments.mainDocument.id,
        templateAnnexIds: dipTemplateDocuments.annexes.map((document) => document.id),
        selectedElmIds: elmDocuments.map((document) => document.id),
        frozenAt: new Date().toISOString()
      }
    });
  }

  const envelope = await createEnvelope({
    candidateEmail: candidate.user.email,
    candidateName: `${candidate.user.firstname} ${candidate.user.lastname}`.trim(),
    templateId: dipTemplateSettings.docusignTemplateId,
    templateRoleName: dipTemplateSettings.docusignTemplateRoleName,
    attachments: [
      {
        documentBase64: mainDipBase64,
        fileName: dipTemplateDocuments.mainDocument.fileName || "dip-principal.pdf"
      },
      ...orderedAnnexAttachments.map(({ documentBase64, fileName }) => ({
        documentBase64,
        fileName
      }))
    ]
  });

  if (!envelope.envelopeId) {
    throw new Error("DocuSign n'a pas retourné d'identifiant d'enveloppe.");
  }

  const record = await prisma.docuSignEnvelope.create({
    data: {
      candidateId: candidate.id,
      stepNumber: 5,
      envelopeId: envelope.envelopeId,
      status:
        envelope.status === "DELIVERED" ||
        envelope.status === "COMPLETED" ||
        envelope.status === "DECLINED" ||
        envelope.status === "VOIDED"
          ? envelope.status
          : "SENT"
    }
  });

  await logEvent({
    actionType: "DIP_SENT_TO_DOCUSIGN",
    candidateId: candidate.id,
    userId: params.actorUserId,
    detailsJson: {
      envelopeId: record.envelopeId,
      docusignTemplateId: dipTemplateSettings.docusignTemplateId,
      dipFileName: dipTemplateDocuments.mainDocument.fileName,
      templateAnnexIds: dipTemplateDocuments.annexes.map((document) => document.id),
      selectedElmIds: elmDocuments.map((document) => document.id),
      sentAt: new Date().toISOString()
    }
  });

  return record;
}
