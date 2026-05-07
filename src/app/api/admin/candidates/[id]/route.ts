import { CandidateStatusGlobal, CandidateStepStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";
import { getCandidateDetails } from "@/lib/services/candidate";
import { computeHeatScore } from "@/lib/utils/heat-score";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const candidate = await getCandidateDetails(params.id);

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable" }, { status: 404 });
  }

  return NextResponse.json(candidate);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const body = (await request.json()) as {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    zipcode?: string;
    currentStep?: number;
  };

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: { user: true }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable" }, { status: 404 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: candidate.userId },
        data: {
          firstname: body.firstname?.trim() || candidate.user.firstname,
          lastname: body.lastname?.trim() || candidate.user.lastname,
          email: body.email?.trim() || candidate.user.email,
          phone: body.phone?.trim() || null
        }
      });

      if (typeof body.currentStep === "number" && body.currentStep >= 1 && body.currentStep <= 10) {
        const now = new Date();

        await tx.candidateStep.updateMany({
          where: {
            candidateId: params.id,
            stepNumber: { lt: body.currentStep },
            status: { not: CandidateStepStatus.REJECTED }
          },
          data: {
            status: CandidateStepStatus.COMPLETED,
            completedAt: now
          }
        });

        await tx.candidateStep.updateMany({
          where: {
            candidateId: params.id,
            stepNumber: body.currentStep,
            status: { not: CandidateStepStatus.REJECTED }
          },
          data: {
            status: CandidateStepStatus.AVAILABLE,
            completedAt: null,
            validatedById: null,
            validationComment: null
          }
        });

        await tx.candidateStep.updateMany({
          where: {
            candidateId: params.id,
            stepNumber: { gt: body.currentStep },
            status: { not: CandidateStepStatus.REJECTED }
          },
          data: {
            status: CandidateStepStatus.LOCKED,
            completedAt: null,
            validatedById: null,
            validationComment: null
          }
        });
      }

      return tx.candidate.update({
        where: { id: params.id },
        data: {
          address: body.address?.trim() || null,
          city: body.city?.trim() || candidate.city,
          zipcode: body.zipcode?.trim() || null,
          currentStep: typeof body.currentStep === "number" && body.currentStep >= 1 && body.currentStep <= 10 ? body.currentStep : candidate.currentStep,
          statusGlobal:
            typeof body.currentStep === "number" && body.currentStep >= 1 && body.currentStep <= 10
              ? body.currentStep === 1
                ? CandidateStatusGlobal.NEW
                : CandidateStatusGlobal.ACTIVE
              : candidate.statusGlobal,
          scoreHeat:
            typeof body.currentStep === "number" && body.currentStep >= 1 && body.currentStep <= 10
              ? computeHeatScore(body.currentStep, 0)
              : candidate.scoreHeat,
          lastActivityAt: new Date()
        }
      });
    });

    if (typeof body.currentStep === "number" && body.currentStep >= 1 && body.currentStep <= 10 && body.currentStep !== candidate.currentStep) {
      await logEvent({
        actionType: "STEP_CHANGED_MANUALLY",
        candidateId: params.id,
        userId: auth.session?.user.id,
        detailsJson: {
          previousStep: candidate.currentStep,
          nextStep: body.currentStep
        }
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Un candidat avec cet email existe deja." }, { status: 409 });
    }

    return NextResponse.json({ error: "Impossible de mettre à jour le candidat." }, { status: 500 });
  }
}
