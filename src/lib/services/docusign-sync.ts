import { addDays } from "date-fns";
import { createDipLegalDelayCalendarEvent } from "@/lib/integrations/google-calendar";
import { downloadCombinedEnvelopePdf, getEnvelopeStatus } from "@/lib/integrations/docusign";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";

const FINAL_DOCUSIGN_STATUSES = new Set(["COMPLETED", "DECLINED", "VOIDED"]);

function getContractSignedFileName(contractType: string, firstname: string, lastname: string) {
  const prefix =
    contractType === "contrat_reservation_zone"
      ? "Contrat de réservation de zone signé"
      : "Contrat définitif signé";

  return `${prefix} - ${firstname} ${lastname}.pdf`;
}

export async function syncCandidateDipEnvelopeState(
  candidateId: string,
  options?: {
    force?: boolean;
    skipIfFreshMs?: number;
  }
) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      user: true,
      docusignEnvelopes: {
        where: { stepNumber: 5 },
        orderBy: { createdAt: "desc" }
      },
      documents: {
        where: { type: "dip" },
        orderBy: { uploadedAt: "desc" }
      }
    }
  });

  if (!candidate) {
    return null;
  }

  const latestEnvelope = candidate.docusignEnvelopes[0];
  if (!latestEnvelope) {
    return null;
  }

  const skipIfFreshMs = options?.skipIfFreshMs ?? 120_000;
  const envelopeAgeMs = Date.now() - new Date(latestEnvelope.updatedAt).getTime();
  const hasFinalStatus = FINAL_DOCUSIGN_STATUSES.has(latestEnvelope.status);

  if (!options?.force) {
    if (hasFinalStatus && (latestEnvelope.status !== "COMPLETED" || Boolean(latestEnvelope.signedFileUrl))) {
      return null;
    }

    if (envelopeAgeMs < skipIfFreshMs) {
      return null;
    }
  }

  const remoteEnvelope = await getEnvelopeStatus({ envelopeId: latestEnvelope.envelopeId });
  const nextStatus = remoteEnvelope.status;
  const wasCompleted = latestEnvelope.status === "COMPLETED";

  let signedFileUrl = latestEnvelope.signedFileUrl;
  let signedAt = remoteEnvelope.completedDateTime || remoteEnvelope.statusChangedDateTime || new Date().toISOString();

  if (nextStatus === "COMPLETED" && !signedFileUrl) {
    signedFileUrl = await downloadCombinedEnvelopePdf({ envelopeId: latestEnvelope.envelopeId });
  }

  const updatedEnvelope =
    nextStatus !== latestEnvelope.status || signedFileUrl !== latestEnvelope.signedFileUrl
      ? await prisma.docuSignEnvelope.update({
          where: { id: latestEnvelope.id },
          data: {
            status:
              nextStatus === "DELIVERED" ||
              nextStatus === "COMPLETED" ||
              nextStatus === "DECLINED" ||
              nextStatus === "VOIDED"
                ? nextStatus
                : "SENT",
            signedFileUrl: signedFileUrl ?? latestEnvelope.signedFileUrl
          }
        })
      : latestEnvelope;

  if (nextStatus === "COMPLETED" && signedFileUrl) {
    const signedDipFileName = `DIP signé - ${candidate.user.firstname} ${candidate.user.lastname}.pdf`;
    const existingDipDocument = candidate.documents[0];

    if (existingDipDocument) {
      await prisma.document.update({
        where: { id: existingDipDocument.id },
        data: {
          fileUrl: signedFileUrl,
          fileName: signedDipFileName,
          mimeType: "application/pdf"
        }
      });
    } else {
      await prisma.document.create({
        data: {
          candidateId: candidate.id,
          stepNumber: 5,
          type: "dip",
          fileUrl: signedFileUrl,
          fileName: signedDipFileName,
          mimeType: "application/pdf",
          uploadedById: candidate.userId
        }
      });
    }
  }

  if (nextStatus === "COMPLETED") {
    const deadline = addDays(new Date(signedAt), 20);

    await createDipLegalDelayCalendarEvent({
      candidateId: candidate.id,
      candidateName: `${candidate.user.firstname} ${candidate.user.lastname}`.trim(),
      city: candidate.projectZone || candidate.city || "",
      deadline
    }).catch(async (error) => {
      await logEvent({
        actionType: "DIP_LEGAL_DELAY_EVENT_FAILED",
        candidateId: candidate.id,
        detailsJson: {
          envelopeId: latestEnvelope.envelopeId,
          error: error instanceof Error ? error.message : "Erreur inconnue"
        }
      });
    });

    const existingDeadlineNote = await prisma.noteAdmin.findFirst({
      where: {
        candidateId: candidate.id,
        noteText: `Fin délai DIP le ${deadline.toLocaleDateString("fr-FR")}.`
      }
    });

    if (!existingDeadlineNote) {
      const noteAuthorId =
        candidate.assignedDevId ??
        (
          await prisma.user.findFirst({
            where: { role: { in: ["ADMIN", "DEV"] } },
            orderBy: { createdAt: "asc" }
          })
        )?.id;

      if (noteAuthorId) {
        await prisma.noteAdmin.create({
          data: {
            candidateId: candidate.id,
            authorId: noteAuthorId,
            noteText: `Fin délai DIP le ${deadline.toLocaleDateString("fr-FR")}.`
          }
        });
      }
    }
  }

  if (nextStatus === "COMPLETED" && !wasCompleted) {
    await logEvent({
      actionType: "DIP_RECEIPT_SIGNED",
      candidateId: candidate.id,
      detailsJson: {
        envelopeId: latestEnvelope.envelopeId,
        signedAt
      }
    });
  }

  return null;
}

export async function syncCandidateContractEnvelopeState(
  candidateId: string,
  options?: {
    force?: boolean;
    skipIfFreshMs?: number;
  }
) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      user: true,
      docusignEnvelopes: {
        where: { stepNumber: 8 },
        orderBy: { createdAt: "desc" }
      },
      documents: {
        where: {
          type: {
            in: ["contrat_reservation_zone", "contrat_definitif"]
          }
        },
        orderBy: { uploadedAt: "desc" }
      },
      eventLogs: {
        where: {
          actionType: "CONTRACT_SENT_TO_DOCUSIGN"
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!candidate || !candidate.docusignEnvelopes.length) {
    return null;
  }

  const skipIfFreshMs = options?.skipIfFreshMs ?? 120_000;

  for (const envelopeRecord of candidate.docusignEnvelopes) {
    const envelopeAgeMs = Date.now() - new Date(envelopeRecord.updatedAt).getTime();
    const hasFinalStatus = FINAL_DOCUSIGN_STATUSES.has(envelopeRecord.status);

    if (!options?.force) {
      if (hasFinalStatus && (envelopeRecord.status !== "COMPLETED" || Boolean(envelopeRecord.signedFileUrl))) {
        continue;
      }

      if (envelopeAgeMs < skipIfFreshMs) {
        continue;
      }
    }

    const remoteEnvelope = await getEnvelopeStatus({ envelopeId: envelopeRecord.envelopeId });
    const nextStatus = remoteEnvelope.status;
    const wasCompleted = envelopeRecord.status === "COMPLETED";
    let signedFileUrl = envelopeRecord.signedFileUrl;
    const signedAt = remoteEnvelope.completedDateTime || remoteEnvelope.statusChangedDateTime || new Date().toISOString();

    if (nextStatus === "COMPLETED" && !signedFileUrl) {
      signedFileUrl = await downloadCombinedEnvelopePdf({ envelopeId: envelopeRecord.envelopeId });
    }

    const updatedEnvelope =
      nextStatus !== envelopeRecord.status || signedFileUrl !== envelopeRecord.signedFileUrl
        ? await prisma.docuSignEnvelope.update({
            where: { id: envelopeRecord.id },
            data: {
              status:
                nextStatus === "DELIVERED" ||
                nextStatus === "COMPLETED" ||
                nextStatus === "DECLINED" ||
                nextStatus === "VOIDED"
                  ? nextStatus
                  : "SENT",
              signedFileUrl: signedFileUrl ?? envelopeRecord.signedFileUrl
            }
          })
        : envelopeRecord;

    const sendLog = candidate.eventLogs.find((log) => {
      const details = (log.detailsJson ?? {}) as Record<string, unknown>;
      return String(details.envelopeId ?? "") === envelopeRecord.envelopeId;
    });

    const logDetails = ((sendLog?.detailsJson ?? {}) as Record<string, unknown>) || {};
    const contractType = String(logDetails.contractType ?? "");
    const documentId = String(logDetails.documentId ?? "");

    if (
      nextStatus === "COMPLETED" &&
      signedFileUrl &&
      (contractType === "contrat_reservation_zone" || contractType === "contrat_definitif")
    ) {
      const targetDocument =
        candidate.documents.find((document) => document.id === documentId) ??
        candidate.documents.find((document) => document.type === contractType);

      if (targetDocument) {
        await prisma.document.update({
          where: { id: targetDocument.id },
          data: {
            fileUrl: signedFileUrl,
            fileName: getContractSignedFileName(contractType, candidate.user.firstname, candidate.user.lastname),
            mimeType: "application/pdf"
          }
        });
      }
    }

    if (nextStatus === "COMPLETED" && !wasCompleted) {
      await logEvent({
        actionType: "CONTRACT_SIGNED",
        candidateId: candidate.id,
        detailsJson: {
          envelopeId: updatedEnvelope.envelopeId,
          signedAt,
          contractType
        }
      });
    }
  }

  return null;
}
