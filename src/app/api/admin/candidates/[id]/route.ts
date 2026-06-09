import { CandidateStatusGlobal, CandidateStepStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";
import { syncCandidateContractEnvelopeState, syncCandidateDipEnvelopeState } from "@/lib/services/docusign-sync";
import { sendApplicationInvitationEmail } from "@/lib/services/application-workflow";
import { sendDiscoveryInvitationEmail } from "@/lib/services/discovery-workflow";
import { getStep7Requirements } from "@/lib/services/candidate-step-rules";
import { computeHeatScore } from "@/lib/utils/heat-score";

async function trySyncCandidateDipEnvelopeState(candidateId: string) {
  await Promise.race([
    syncCandidateDipEnvelopeState(candidateId, { skipIfFreshMs: 180_000 }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
  ]).catch(() => null);
}

async function trySyncCandidateContractEnvelopeState(candidateId: string) {
  await Promise.race([
    syncCandidateContractEnvelopeState(candidateId, { skipIfFreshMs: 180_000 }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
  ]).catch(() => null);
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  await Promise.allSettled([
    trySyncCandidateDipEnvelopeState(params.id),
    trySyncCandidateContractEnvelopeState(params.id)
  ]);
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      user: {
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          phone: true
        }
      },
      assignedDev: {
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true
        }
      },
      steps: {
        orderBy: { stepNumber: "asc" },
        select: {
          id: true,
          stepNumber: true,
          status: true,
          completedAt: true,
          validatedById: true,
          validationComment: true
        }
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          type: true,
          fileName: true,
          mimeType: true,
          uploadedAt: true,
          stepNumber: true
        }
      },
      eventLogs: {
        where: {
          actionType: {
            in: [
              "CANDIDATE_APPLICATION_UPDATED",
              "DISCOVERY_FEEDBACK_SUBMITTED",
              "CONTRACT_SENT_TO_DOCUSIGN"
            ]
          }
        },
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 12
      },
      appointments: {
        orderBy: { startDatetime: "desc" },
        select: {
          id: true,
          appointmentType: true,
          startDatetime: true,
          endDatetime: true,
          status: true
        }
      },
      docusignEnvelopes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          stepNumber: true,
          envelopeId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          signedFileUrl: true
        }
      },
      localProjects: {
        orderBy: { id: "desc" },
        select: {
          id: true,
          address: true,
          city: true,
          zipcode: true,
          surfaceM2: true,
          notesCandidate: true,
          status: true,
          files: {
            orderBy: { uploadedAt: "desc" },
            select: {
              id: true,
              fileType: true,
              uploadedAt: true
            }
          }
        }
      }
    }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable" }, { status: 404 });
  }

  const profilePhoto = await prisma.document.findFirst({
    where: {
      candidateId: params.id,
      type: "photo_profil"
    },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      type: true,
      fileName: true,
      mimeType: true,
      uploadedAt: true,
      stepNumber: true,
      fileUrl: true
    }
  });

  const documents: Array<{
    id: string;
    type: string;
    fileName: string;
    mimeType: string;
    uploadedAt: Date;
    stepNumber: number | null;
    fileUrl: string | null;
  }> = candidate.documents.map((document) => ({
    ...document,
    fileUrl: null
  }));

  if (profilePhoto) {
    const existingPhotoIndex = documents.findIndex((document) => document.id === profilePhoto.id);

    if (existingPhotoIndex >= 0) {
      documents[existingPhotoIndex] = profilePhoto;
    } else {
      documents.unshift(profilePhoto);
    }
  }

  return NextResponse.json({
    ...candidate,
    documents
  });
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
    sendInvitationEmail?: boolean;
    skipInvitationEmail?: boolean;
    sendDiscoveryEmail?: boolean;
    skipDiscoveryEmail?: boolean;
    invitationEmail?: {
      subject?: string;
      bodyText?: string;
      attachments?: Array<{
        fileName: string;
        mimeType: string;
        fileUrl: string;
      }>;
    };
    discoveryEmail?: {
      subject?: string;
      bodyText?: string;
      attachments?: Array<{
        fileName: string;
        mimeType: string;
        fileUrl: string;
      }>;
    };
  };

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: { user: true }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable" }, { status: 404 });
  }

  if (
    typeof body.currentStep === "number" &&
    body.currentStep >= 8 &&
    candidate.currentStep <= 7
  ) {
    const requirements = await getStep7Requirements(params.id);

    if (!requirements.isComplete) {
      return NextResponse.json(
        {
          error: `Impossible de passer à l’étape Contrat et formation. Il manque ${requirements.missing.join(", ")}.`
        },
        { status: 409 }
      );
    }
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

      if (candidate.currentStep === 1 && body.currentStep === 2 && !body.skipInvitationEmail) {
        if (body.sendInvitationEmail === false) {
          return NextResponse.json(updated);
        }

        try {
          await sendApplicationInvitationEmail(params.id, auth.session?.user.id, body.invitationEmail);
        } catch (mailError) {
          const message = mailError instanceof Error ? mailError.message : "Erreur inconnue";

          await logEvent({
            actionType: "CANDIDATE_APPLICATION_INVITATION_FAILED",
            candidateId: params.id,
            userId: auth.session?.user.id,
            detailsJson: {
              error: message
            }
          });

          return NextResponse.json({
            ...updated,
            mailWarning:
              "Le candidat est bien passé à l'étape dossier de candidature, mais le mail n'a pas pu partir. Détail : " +
              message
          });
        }
      }

      if (candidate.currentStep === 3 && body.currentStep === 4 && !body.skipDiscoveryEmail) {
        if (body.sendDiscoveryEmail === false) {
          return NextResponse.json(updated);
        }

        try {
          await sendDiscoveryInvitationEmail(params.id, auth.session?.user.id, body.discoveryEmail);
        } catch (mailError) {
          const message = mailError instanceof Error ? mailError.message : "Erreur inconnue";

          await logEvent({
            actionType: "DISCOVERY_DAY_INVITATION_FAILED",
            candidateId: params.id,
            userId: auth.session?.user.id,
            detailsJson: {
              error: message
            }
          });

          return NextResponse.json({
            ...updated,
            mailWarning:
              "Le candidat est bien passé à l'étape suivante, mais le mail de journée découverte n'a pas pu partir. Détail : " +
              message
          });
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Un candidat avec cet email existe deja." }, { status: 409 });
    }

    return NextResponse.json({ error: "Impossible de mettre à jour le candidat." }, { status: 500 });
  }
}
