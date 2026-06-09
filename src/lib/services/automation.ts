import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { validateStep } from "@/lib/services/candidate";
import { sendTemplatedEmail } from "@/lib/services/email";
import { logEvent } from "@/lib/services/event-log";
import { computeHeatScore } from "@/lib/utils/heat-score";

async function advanceCandidatesAfterDipLegalDelay() {
  const candidates = await prisma.candidate.findMany({
    where: {
      currentStep: 5,
      docusignEnvelopes: {
        some: {
          stepNumber: 5,
          status: "COMPLETED"
        }
      }
    },
    include: {
      user: true,
      docusignEnvelopes: {
        where: {
          stepNumber: 5,
          status: "COMPLETED"
        },
        orderBy: { updatedAt: "desc" }
      },
      eventLogs: {
        where: {
          actionType: "DIP_LEGAL_DELAY_COMPLETED"
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  let advanced = 0;

  for (const candidate of candidates) {
    const latestCompletedEnvelope = candidate.docusignEnvelopes[0];
    if (!latestCompletedEnvelope) continue;
    if (candidate.eventLogs.length > 0) continue;

    const daysSinceSignature = differenceInDays(new Date(), latestCompletedEnvelope.updatedAt);
    if (daysSinceSignature < 20) continue;

    await completeDipLegalDelayForCandidate(candidate.id);
    advanced += 1;
  }

  return {
    advanced
  };
}

export async function completeDipLegalDelayForCandidate(candidateId: string, userId?: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      user: true,
      docusignEnvelopes: {
        where: {
          stepNumber: 5,
          status: "COMPLETED"
        },
        orderBy: { updatedAt: "desc" }
      },
      eventLogs: {
        where: {
          actionType: "DIP_LEGAL_DELAY_COMPLETED"
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!candidate) {
    throw new Error("Candidat introuvable.");
  }

  if (candidate.currentStep !== 5) {
    throw new Error("Le candidat n'est plus à l'étape DIP et ELM.");
  }

  if (candidate.eventLogs.length > 0) {
    return { alreadyCompleted: true };
  }

  const latestCompletedEnvelope = candidate.docusignEnvelopes[0];
  if (!latestCompletedEnvelope) {
    throw new Error("Le DIP n'est pas encore signé.");
  }

  await validateStep({
    candidateId: candidate.id,
    stepNumber: 5,
    userId
  });

  await sendTemplatedEmail({
    templateSlug: "candidate-local-project-opened",
    to: candidate.user.email,
    candidateId: candidate.id,
    replacements: {
      firstname: candidate.user.firstname
    }
  });

  await logEvent({
    actionType: "DIP_LEGAL_DELAY_COMPLETED",
    candidateId: candidate.id,
    userId,
    detailsJson: {
      envelopeId: latestCompletedEnvelope.envelopeId,
      signedAt: latestCompletedEnvelope.updatedAt.toISOString(),
      advancedAt: new Date().toISOString(),
      advancedToStep: 6,
      simulated: Boolean(userId)
    }
  });

  return { alreadyCompleted: false };
}

export async function runDailyAutomation() {
  const candidates = await prisma.candidate.findMany({
    include: { user: true, assignedDev: true }
  });

  for (const candidate of candidates) {
    const inactivityDays = differenceInDays(new Date(), candidate.lastActivityAt);
    const scoreHeat = computeHeatScore(candidate.currentStep, inactivityDays);

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        scoreHeat,
        statusGlobal: inactivityDays >= 30 ? "INACTIVE" : candidate.statusGlobal
      }
    });

    if (inactivityDays >= 7 && inactivityDays < 14) {
      await sendTemplatedEmail({
        templateSlug: "welcome-candidate",
        to: candidate.user.email,
        candidateId: candidate.id,
        replacements: {
          firstname: candidate.user.firstname,
          onboardingUrl: `${process.env.NEXTAUTH_URL}/candidat/dashboard`
        }
      });
    }

    if (inactivityDays >= 14) {
      await prisma.reminder.create({
        data: {
          candidateId: candidate.id,
          assignedToId: candidate.assignedDevId ?? candidate.userId,
          reminderTitle: "Candidat inactif",
          reminderText: `Le candidat n'a pas avancé depuis ${inactivityDays} jours.`,
          dueDate: new Date()
        }
      });
    }

    if (inactivityDays >= 30) {
      await logEvent({
        actionType: "CANDIDATE_MARKED_INACTIVE",
        candidateId: candidate.id,
        detailsJson: { inactivityDays }
      });
    }
  }

  const dipLegalDelay = await advanceCandidatesAfterDipLegalDelay();

  return {
    dipLegalDelay
  };
}
