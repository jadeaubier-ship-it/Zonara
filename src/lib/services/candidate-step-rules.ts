import { CandidateStepStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";
import { computeHeatScore } from "@/lib/utils/heat-score";

const STEP7_REQUIRED_DOCUMENT_TYPES = [
  "business_plan",
  "carte_identite",
  "justificatif_domicile",
  "statuts"
] as const;

const STEP8_CONTRACT_TYPES = ["contrat_reservation_zone", "contrat_definitif"] as const;

export async function getStep7Requirements(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      currentStep: true,
      localProjects: {
        where: { status: "VALIDATED" },
        select: { id: true }
      },
      documents: {
        select: {
          type: true,
          fileName: true
        }
      }
    }
  });

  if (!candidate) {
    throw new Error("Candidat introuvable.");
  }

  const documentTypes = new Set(candidate.documents.map((document) => document.type));
  const missing: string[] = [];

  if (candidate.localProjects.length === 0) {
    missing.push("au moins un local validé");
  }

  for (const type of STEP7_REQUIRED_DOCUMENT_TYPES) {
    if (!documentTypes.has(type)) {
      switch (type) {
        case "business_plan":
          missing.push("le business plan");
          break;
        case "carte_identite":
          missing.push("la carte d'identité");
          break;
        case "justificatif_domicile":
          missing.push("le justificatif de domicile");
          break;
        case "statuts":
          missing.push("les statuts de l'entreprise");
          break;
      }
    }
  }

  return {
    candidate,
    isComplete: missing.length === 0,
    missing
  };
}

export async function autoAdvanceCandidateFromStep7(candidateId: string, userId?: string) {
  const requirements = await getStep7Requirements(candidateId);

  if (!requirements.isComplete || requirements.candidate.currentStep !== 7) {
    return {
      advanced: false,
      missing: requirements.missing
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.candidateStep.update({
      where: {
        candidateId_stepNumber: {
          candidateId,
          stepNumber: 7
        }
      },
      data: {
        status: CandidateStepStatus.COMPLETED,
        completedAt: new Date(),
        validatedById: userId ?? null
      }
    });

    await tx.candidateStep.update({
      where: {
        candidateId_stepNumber: {
          candidateId,
          stepNumber: 8
        }
      },
      data: {
        status: CandidateStepStatus.AVAILABLE,
        completedAt: null,
        validatedById: null,
        validationComment: null
      }
    });

    await tx.candidate.update({
      where: { id: candidateId },
      data: {
        currentStep: 8,
        lastActivityAt: new Date(),
        scoreHeat: computeHeatScore(8, 0)
      }
    });
  });

  await logEvent({
    actionType: "STEP_7_AUTO_COMPLETED",
    candidateId,
    userId,
    detailsJson: {
      nextStep: 8,
      reason: "step_7_requirements_completed"
    }
  });

  return {
    advanced: true,
    missing: []
  };
}

export async function getStep8Requirements(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      currentStep: true,
      documents: {
        select: {
          type: true,
          fileName: true
        }
      },
      appointments: {
        where: {
          appointmentType: "FORMATION",
          status: { not: "CANCELLED" }
        },
        select: {
          id: true
        }
      }
    }
  });

  if (!candidate) {
    throw new Error("Candidat introuvable.");
  }

  const documentTypes = new Set(candidate.documents.map((document) => document.type));
  const missing: string[] = [];

  if (!STEP8_CONTRACT_TYPES.some((type) => documentTypes.has(type))) {
    missing.push("un contrat de réservation ou un contrat définitif");
  }

  if (candidate.appointments.length === 0) {
    missing.push("les dates de formation");
  }

  return {
    candidate,
    isComplete: missing.length === 0,
    missing
  };
}

export async function autoAdvanceCandidateFromStep8(candidateId: string, userId?: string) {
  const requirements = await getStep8Requirements(candidateId);

  if (!requirements.isComplete || requirements.candidate.currentStep !== 8) {
    return {
      advanced: false,
      missing: requirements.missing
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.candidateStep.update({
      where: {
        candidateId_stepNumber: {
          candidateId,
          stepNumber: 8
        }
      },
      data: {
        status: CandidateStepStatus.COMPLETED,
        completedAt: new Date(),
        validatedById: userId ?? null
      }
    });

    await tx.candidateStep.update({
      where: {
        candidateId_stepNumber: {
          candidateId,
          stepNumber: 9
        }
      },
      data: {
        status: CandidateStepStatus.AVAILABLE,
        completedAt: null,
        validatedById: null,
        validationComment: null
      }
    });

    await tx.candidate.update({
      where: { id: candidateId },
      data: {
        currentStep: 9,
        lastActivityAt: new Date(),
        scoreHeat: computeHeatScore(9, 0)
      }
    });
  });

  await logEvent({
    actionType: "STEP_8_AUTO_COMPLETED",
    candidateId,
    userId,
    detailsJson: {
      nextStep: 9,
      reason: "training_dates_saved"
    }
  });

  return {
    advanced: true,
    missing: []
  };
}
