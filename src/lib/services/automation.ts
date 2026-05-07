import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { sendTemplatedEmail } from "@/lib/services/email";
import { logEvent } from "@/lib/services/event-log";
import { computeHeatScore } from "@/lib/utils/heat-score";

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
}
