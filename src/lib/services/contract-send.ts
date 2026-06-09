import { prisma } from "@/lib/db/prisma";
import { createContractEnvelope } from "@/lib/integrations/docusign";
import { logEvent } from "@/lib/services/event-log";
import { getAppSettings } from "@/lib/services/settings-store";

const CONTRACT_TYPES = new Set(["contrat_reservation_zone", "contrat_definitif"]);
const ACTIVE_STATUSES = new Set(["CREATED", "SENT", "DELIVERED"]);

function extractBase64FromDataUrl(value: string) {
  const match = value.match(/^data:.*?;base64,(.*)$/);
  return match?.[1] ?? "";
}

function resolveCeoIdentity(settings: Awaited<ReturnType<typeof getAppSettings>>) {
  const fallbackName = "Benoit Michaut";
  const fallbackEmail = settings.senderEmail.trim() || "franchise@atome3d.com";

  return {
    name: settings.superAdminName.trim() || fallbackName,
    email: fallbackEmail
  };
}

function getContractLabel(contractType: string) {
  return contractType === "contrat_reservation_zone"
    ? "Contrat de réservation de zone"
    : "Contrat définitif";
}

export async function sendContractEnvelopeForCandidate(params: {
  candidateId: string;
  actorUserId: string;
  documentId: string;
}) {
  const [candidate, settings] = await Promise.all([
    prisma.candidate.findUniqueOrThrow({
      where: { id: params.candidateId },
      include: {
        user: true,
        documents: {
          where: {
            id: params.documentId,
            type: {
              in: ["contrat_reservation_zone", "contrat_definitif"]
            }
          }
        },
        docusignEnvelopes: {
          where: { stepNumber: 8 },
          orderBy: { createdAt: "desc" }
        },
        eventLogs: {
          where: {
            actionType: "CONTRACT_SENT_TO_DOCUSIGN"
          },
          orderBy: { createdAt: "desc" }
        }
      }
    }),
    getAppSettings()
  ]);

  const contractDocument = candidate.documents[0];
  if (!contractDocument || !CONTRACT_TYPES.has(contractDocument.type)) {
    throw new Error("Le contrat à envoyer est introuvable.");
  }

  const activeSameTypeEnvelope = candidate.docusignEnvelopes.find((envelope) => {
    if (!ACTIVE_STATUSES.has(envelope.status)) return false;

    const matchingLog = candidate.eventLogs.find((log) => {
      const details = (log.detailsJson ?? {}) as Record<string, unknown>;
      return (
        String(details.envelopeId ?? "") === envelope.envelopeId &&
        String(details.contractType ?? "") === contractDocument.type
      );
    });

    return Boolean(matchingLog);
  });

  if (activeSameTypeEnvelope) {
    throw new Error("Une signature de contrat est déjà en cours pour ce document.");
  }

  const documentBase64 = extractBase64FromDataUrl(contractDocument.fileUrl);
  if (!documentBase64) {
    throw new Error("Le PDF du contrat est invalide.");
  }

  const ceo = resolveCeoIdentity(settings);
  const envelope = await createContractEnvelope({
    ceoEmail: ceo.email,
    ceoName: ceo.name,
    candidateEmail: candidate.user.email,
    candidateName: `${candidate.user.firstname} ${candidate.user.lastname}`.trim(),
    ccEmail:
      settings.senderEmail.trim() && settings.senderEmail.trim().toLowerCase() !== ceo.email.toLowerCase()
        ? settings.senderEmail.trim()
        : undefined,
    ccName: settings.brandName.trim() || "Atome3D",
    documentBase64,
    fileName: contractDocument.fileName,
    emailSubject: `${getContractLabel(contractDocument.type)} - ${candidate.user.firstname} ${candidate.user.lastname}`.trim()
  });

  if (!envelope.envelopeId) {
    throw new Error("DocuSign n'a pas retourné d'identifiant d'enveloppe.");
  }

  const record = await prisma.docuSignEnvelope.create({
    data: {
      candidateId: candidate.id,
      stepNumber: 8,
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
    actionType: "CONTRACT_SENT_TO_DOCUSIGN",
    candidateId: candidate.id,
    userId: params.actorUserId,
    detailsJson: {
      envelopeId: record.envelopeId,
      contractType: contractDocument.type,
      documentId: contractDocument.id,
      fileName: contractDocument.fileName,
      sentAt: new Date().toISOString(),
      ceoName: ceo.name,
      ceoEmail: ceo.email,
      candidateEmail: candidate.user.email
    }
  });

  return record;
}
