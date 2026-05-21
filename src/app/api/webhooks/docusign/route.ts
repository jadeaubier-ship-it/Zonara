import { addDays } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createDipLegalDelayCalendarEvent } from "@/lib/integrations/google-calendar";
import { logEvent } from "@/lib/services/event-log";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const envelopeId = String(body.envelopeId);
  const status = String(body.status ?? "COMPLETED").toLowerCase();

  const envelope = await prisma.docuSignEnvelope.update({
    where: { envelopeId },
    data: { status: status === "completed" ? "COMPLETED" : "DELIVERED" }
  });

  if (status === "completed") {
    await logEvent({
      actionType: "DIP_RECEIPT_SIGNED",
      candidateId: envelope.candidateId,
      detailsJson: {
        envelopeId: envelope.envelopeId,
        signedAt: new Date().toISOString()
      }
    });

    const candidate = await prisma.candidate.findUnique({
      where: { id: envelope.candidateId },
      include: { user: true }
    });

    if (candidate) {
      await createDipLegalDelayCalendarEvent({
        candidateId: candidate.id,
        candidateName: `${candidate.user.firstname} ${candidate.user.lastname}`.trim(),
        city: candidate.projectZone || candidate.city || "",
        deadline: addDays(new Date(), 20)
      }).catch(async (error) => {
        await logEvent({
          actionType: "DIP_LEGAL_DELAY_EVENT_FAILED",
          candidateId: candidate.id,
          detailsJson: {
            envelopeId: envelope.envelopeId,
            error: error instanceof Error ? error.message : "Erreur inconnue"
          }
        });
      });
    }
  }

  return NextResponse.json({ success: true });
}
