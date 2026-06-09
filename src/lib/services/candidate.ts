import bcrypt from "bcryptjs";
import {
  CandidateStepStatus,
  CandidateStatusGlobal,
  PaymentType,
  UserRole
} from "@prisma/client";
import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { sendTemplatedEmail } from "@/lib/services/email";
import { logEvent } from "@/lib/services/event-log";
import { geocodeFrenchCity } from "@/lib/services/geocoding";
import { getStep7Requirements } from "@/lib/services/candidate-step-rules";
import { computeHeatScore } from "@/lib/utils/heat-score";
import { generateOnboardingToken, onboardingExpiration } from "@/lib/utils/security";

export async function createCandidate(input: {
  firstname: string;
  lastname: string;
  email: string;
  createdAt?: string;
  phone?: string;
  address?: string;
  city: string;
  zipcode?: string;
  source?: string;
  comment?: string;
  assignedDevId?: string;
  createdById?: string;
}) {
  const onboardingToken = generateOnboardingToken();
  const temporaryPassword = await bcrypt.hash(generateOnboardingToken(), 12);
  const createdAt = input.createdAt ? new Date(`${input.createdAt}T12:00:00`) : new Date();
  const location = await geocodeFrenchCity({
    city: input.city,
    zipcode: input.zipcode
  });

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        firstname: input.firstname,
        lastname: input.lastname,
        phone: input.phone,
        createdAt,
        password: temporaryPassword,
        role: UserRole.CANDIDATE
      }
    });

    const candidate = await tx.candidate.create({
      data: {
        userId: user.id,
        address: input.address,
        city: input.city,
        zipcode: input.zipcode,
        source: input.source,
        latitude: location?.latitude,
        longitude: location?.longitude,
        createdAt,
        lastActivityAt: createdAt,
        assignedDevId: input.assignedDevId,
        onboardingToken,
        tokenExpirationDate: onboardingExpiration(),
        currentStep: 1,
        statusGlobal: CandidateStatusGlobal.NEW,
        scoreHeat: "COLD"
      }
    });

    await tx.candidateStep.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        candidateId: candidate.id,
        stepNumber: index + 1,
        status: index === 0 ? CandidateStepStatus.AVAILABLE : CandidateStepStatus.LOCKED
      }))
    });

    if (input.comment?.trim() && input.createdById) {
      await tx.noteAdmin.create({
        data: {
          candidateId: candidate.id,
          authorId: input.createdById,
          noteText: input.comment.trim()
        }
      });
    }

    return { user, candidate };
  });

  const onboardingUrl = `${process.env.NEXTAUTH_URL}/onboarding/${onboardingToken}`;

  await sendTemplatedEmail({
    templateSlug: "welcome-candidate",
    to: result.user.email,
    candidateId: result.candidate.id,
    replacements: {
      firstname: result.user.firstname,
      onboardingUrl
    }
  });

  await logEvent({
    actionType: "CANDIDATE_CREATED",
    candidateId: result.candidate.id,
    userId: input.createdById,
    detailsJson: { onboardingUrl, source: input.source ?? null, comment: input.comment ?? null }
  });

  return result;
}

export async function getCandidateList(filters: {
  assignedDevId?: string;
  city?: string;
  statusGlobal?: CandidateStatusGlobal;
  step?: number;
  inactivityDays?: number;
  includeArchived?: boolean;
}) {
  const now = new Date();

  const items = await prisma.candidate.findMany({
    where: {
      isArchived: filters.includeArchived ? undefined : false,
      assignedDevId: filters.assignedDevId,
      city: filters.city
        ? {
            contains: filters.city,
            mode: "insensitive"
          }
        : undefined,
      statusGlobal: filters.statusGlobal,
      currentStep: filters.step,
      ...(filters.inactivityDays
        ? {
            lastActivityAt: {
              lte: new Date(now.getTime() - filters.inactivityDays * 24 * 60 * 60 * 1000)
            }
          }
        : {})
    },
    include: {
      user: true,
      assignedDev: true,
      appointments: true,
      reminders: {
        where: { isDone: false }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return items.map((candidate) => ({
    ...candidate,
    inactivityDays: differenceInDays(now, candidate.lastActivityAt)
  }));
}

export async function archiveCandidates(candidateIds: string[], userId: string) {
  if (!candidateIds.length) {
    return { count: 0 };
  }

  const result = await prisma.candidate.updateMany({
    where: {
      id: { in: candidateIds }
    },
    data: {
      isArchived: true,
      archivedAt: new Date()
    }
  });

  await Promise.all(
    candidateIds.map((candidateId) =>
      logEvent({
        actionType: "CANDIDATE_ARCHIVED",
        candidateId,
        userId
      })
    )
  );

  return result;
}

export async function unarchiveCandidate(candidateId: string, userId: string) {
  const candidate = await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      isArchived: false,
      archivedAt: null
    }
  });

  await logEvent({
    actionType: "CANDIDATE_UNARCHIVED",
    candidateId,
    userId
  });

  return candidate;
}

export async function getCandidateDetails(candidateId: string) {
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

export async function validateStep(params: {
  candidateId: string;
  stepNumber: number;
  comment?: string;
  userId?: string;
}) {
  if (params.stepNumber === 7) {
    const requirements = await getStep7Requirements(params.candidateId);

    if (!requirements.isComplete) {
      throw new Error(
        `Impossible de finaliser l’étape Pièces société. Il manque ${requirements.missing.join(", ")}.`
      );
    }
  }

  const updatedCandidate = await prisma.$transaction(async (tx) => {
    const candidate = await tx.candidate.findUniqueOrThrow({
      where: { id: params.candidateId }
    });

    if (candidate.currentStep !== params.stepNumber && params.stepNumber < 10) {
      throw new Error("Étape invalide pour validation");
    }

    await tx.candidateStep.update({
      where: {
        candidateId_stepNumber: {
          candidateId: params.candidateId,
          stepNumber: params.stepNumber
        }
      },
      data: {
        status: CandidateStepStatus.COMPLETED,
        completedAt: new Date(),
        validatedById: params.userId,
        validationComment: params.comment
      }
    });

    const nextStep = Math.min(params.stepNumber + 1, 10);

    if (params.stepNumber < 10) {
      await tx.candidateStep.update({
        where: {
          candidateId_stepNumber: {
            candidateId: params.candidateId,
            stepNumber: nextStep
          }
        },
        data: {
          status: CandidateStepStatus.AVAILABLE
        }
      });
    }

    return tx.candidate.update({
      where: { id: params.candidateId },
      data: {
        currentStep: nextStep,
        statusGlobal: nextStep >= 10 ? "WON" : "ACTIVE",
        lastActivityAt: new Date(),
        scoreHeat: computeHeatScore(nextStep, 0)
      }
    });
  });

  await logEvent({
    actionType: "STEP_VALIDATED",
    candidateId: params.candidateId,
    userId: params.userId,
    detailsJson: { stepNumber: params.stepNumber, comment: params.comment ?? null }
  });

  return updatedCandidate;
}

export async function rejectStep(params: {
  candidateId: string;
  stepNumber: number;
  comment: string;
  userId?: string;
}) {
  if (!params.comment.trim()) {
    throw new Error("Un commentaire est obligatoire pour refuser une étape");
  }

  await prisma.candidateStep.update({
    where: {
      candidateId_stepNumber: {
        candidateId: params.candidateId,
        stepNumber: params.stepNumber
      }
    },
    data: {
      status: CandidateStepStatus.REJECTED,
      validationComment: params.comment,
      validatedById: params.userId
    }
  });

  await prisma.candidate.update({
    where: { id: params.candidateId },
    data: {
      statusGlobal: "ACTIVE",
      lastActivityAt: new Date()
    }
  });

  await logEvent({
    actionType: "STEP_REJECTED",
    candidateId: params.candidateId,
    userId: params.userId,
    detailsJson: { stepNumber: params.stepNumber, comment: params.comment }
  });
}

export async function autoAdvanceAfterPayment(candidateId: string, stripePaymentId: string) {
  await prisma.payment.create({
    data: {
      candidateId,
      stripePaymentId,
      amount: 4500,
      currency: "EUR",
      status: "SUCCEEDED",
      paymentType: PaymentType.DISCOVERY_DAY
    }
  });

  return validateStep({
    candidateId,
    stepNumber: 4,
    userId: undefined
  });
}

export async function convertToFranchisee(candidateId: string, userId: string) {
  const franchisee = await prisma.$transaction(async (tx) => {
    const candidate = await tx.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      include: { user: true }
    });

    const franchisee = await tx.franchisee.create({
      data: {
        userId: candidate.userId,
        city: candidate.city,
        openingDate: new Date()
      }
    });

    await tx.user.update({
      where: { id: candidate.userId },
      data: { role: "FRANCHISEE" }
    });

    await tx.candidate.update({
      where: { id: candidateId },
      data: {
        currentStep: 10,
        statusGlobal: "WON",
        scoreHeat: "HOT"
      }
    });

    return franchisee;
  });

  await logEvent({
    actionType: "CANDIDATE_CONVERTED",
    candidateId,
    franchiseeId: franchisee.id,
    userId,
    detailsJson: { userId: franchisee.userId }
  });

  return franchisee;
}
