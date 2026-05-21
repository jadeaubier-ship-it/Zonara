import { addDays } from "date-fns";
import { createDipLegalDelayCalendarEvent } from "@/lib/integrations/google-calendar";
import { downloadCombinedEnvelopePdf, getEnvelopeStatus } from "@/lib/integrations/docusign";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";

export async function syncCandidateDipEnvelopeState(candidateId: string) {
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
    return candidate;
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

  return prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      user: true,
      assignedDev: true,
      steps: {
        orderBy: { stepNumber: "asc" }
      },
      documents: {
        orderBy: { uploadedAt: "desc" }
      },
      localProjects: {
        include: { files: true, validatedBy: true }
      },
      notes: {
        include: { author: true },
        orderBy: { createdAt: "desc" }
      },
      reminders: {
        include: { assignedTo: true },
        orderBy: { dueDate: "asc" }
      },
      eventLogs: {
        include: { user: true },
        orderBy: { createdAt: "desc" }
      },
      appointments: {
        orderBy: { startDatetime: "desc" }
      },
      payments: {
        orderBy: { createdAt: "desc" }
      },
      docusignEnvelopes: {
        orderBy: { createdAt: "desc" }
      },
      emailLogs: {
        orderBy: { sentAt: "desc" }
      }
    }
  });
}
