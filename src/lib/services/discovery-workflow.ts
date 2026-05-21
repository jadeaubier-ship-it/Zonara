import { addDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/db/prisma";
import { sendDipEnvelopeForCandidate } from "@/lib/services/dip-send";
import { sendTemplatedEmail } from "@/lib/services/email";
import { logEvent } from "@/lib/services/event-log";
import { getAppSettings } from "@/lib/services/settings-store";
import { generateOnboardingToken } from "@/lib/utils/security";

export const DISCOVERY_FEEDBACK_FIELD_KEYS = [
  "firstname",
  "lastname",
  "discoveryDate",
  "discoveryFeedback",
  "improvementPoints",
  "continueJourney",
  "stopReason"
] as const;

export type DiscoveryFeedbackValues = Record<(typeof DISCOVERY_FEEDBACK_FIELD_KEYS)[number], string>;

function extractFirstname(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function buildDiscoveryBookingUrl() {
  return process.env.GOOGLE_DISCOVERY_BOOKING_URL ?? "https://calendar.app.google/BKDtER5vDyjrNPjeA";
}

export async function sendDiscoveryInvitationEmail(
  candidateId: string,
  senderUserId?: string,
  overrides?: {
    subject?: string;
    bodyText?: string;
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      fileUrl: string;
    }>;
  }
) {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { user: true }
  });

  const bookingUrl = buildDiscoveryBookingUrl();

  await sendTemplatedEmail({
    templateSlug: "candidate-discovery-invitation",
    to: candidate.user.email,
    candidateId: candidate.id,
    senderUserId,
    subjectOverride: overrides?.subject,
    bodyTextOverride: overrides?.bodyText,
    attachmentsOverride: overrides?.attachments,
    replacements: {
      firstname: candidate.user.firstname,
      bookingUrl
    }
  });

  await logEvent({
    actionType: "DISCOVERY_DAY_INVITED",
    candidateId: candidate.id,
    userId: senderUserId,
    detailsJson: {
      bookingUrl
    }
  });
}

export async function issueDiscoveryFeedbackAccess(params: {
  candidateId: string;
  appointmentId: string;
  appointmentDate: Date;
  actorUserId?: string;
}) {
  const token = generateOnboardingToken();
  const expiresAt = addDays(new Date(), 14);

  await logEvent({
    actionType: "DISCOVERY_FEEDBACK_INVITED",
    candidateId: params.candidateId,
    userId: params.actorUserId,
    detailsJson: {
      token,
      appointmentId: params.appointmentId,
      appointmentDate: params.appointmentDate.toISOString(),
      expiresAt: expiresAt.toISOString()
    }
  });

  return {
    token,
    expiresAt,
    feedbackUrl: `${process.env.NEXTAUTH_URL}/retour-journee/${token}`
  };
}

export async function getCandidateByDiscoveryFeedbackToken(token: string) {
  const logs = await prisma.eventLog.findMany({
    where: { actionType: "DISCOVERY_FEEDBACK_INVITED" },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: {
        include: {
          user: true,
          eventLogs: {
            orderBy: { createdAt: "desc" }
          },
          appointments: {
            orderBy: { startDatetime: "desc" }
          }
        }
      }
    }
  });

  const match = logs.find((log) => {
    const details = log.detailsJson as Record<string, unknown>;
    return details?.token === token;
  });

  if (!match?.candidate) return null;

  const details = match.detailsJson as Record<string, unknown>;
  const expiresAt = typeof details.expiresAt === "string" ? new Date(details.expiresAt) : null;
  if (!expiresAt || expiresAt < new Date()) {
    return null;
  }

  return {
    candidate: match.candidate,
    invitationLog: match
  };
}

export function buildDiscoveryFeedbackValues(candidate: any, invitationLog?: any): DiscoveryFeedbackValues {
  const latestFormEvent = candidate?.eventLogs?.find(
    (log: any) => log.actionType === "DISCOVERY_FEEDBACK_SUBMITTED"
  );
  const raw =
    latestFormEvent?.detailsJson && typeof latestFormEvent.detailsJson === "object"
      ? ((latestFormEvent.detailsJson as any).formData ?? {})
      : {};

  const appointmentDate =
    typeof invitationLog?.detailsJson === "object" && invitationLog?.detailsJson?.appointmentDate
      ? new Date(invitationLog.detailsJson.appointmentDate as string)
      : candidate?.appointments?.find((appointment: any) => appointment.appointmentType === "DISCOVERY_DAY")
          ?.startDatetime;

  return {
    firstname: candidate?.user?.firstname ?? "",
    lastname: candidate?.user?.lastname ?? "",
    discoveryDate: raw.discoveryDate || (appointmentDate ? format(new Date(appointmentDate), "yyyy-MM-dd", { locale: fr }) : ""),
    discoveryFeedback: raw.discoveryFeedback ?? "",
    improvementPoints: raw.improvementPoints ?? "",
    continueJourney: raw.continueJourney ?? "",
    stopReason: raw.stopReason ?? ""
  };
}

export async function saveDiscoveryFeedback(params: {
  candidateId: string;
  actorUserId: string;
  values: DiscoveryFeedbackValues;
}) {
  await logEvent({
    actionType: "DISCOVERY_FEEDBACK_SUBMITTED",
    candidateId: params.candidateId,
    userId: params.actorUserId,
    detailsJson: {
      formData: params.values
    }
  });

  await maybeAdvanceCandidateToDipStep({
    candidateId: params.candidateId,
    actorUserId: params.actorUserId
  });
}

export async function isDiscoveryFeedbackComplete(candidateId: string) {
  const latest = await prisma.eventLog.findFirst({
    where: {
      candidateId,
      actionType: "DISCOVERY_FEEDBACK_SUBMITTED"
    },
    orderBy: { createdAt: "desc" }
  });

  if (!latest) return false;

  const values = (latest.detailsJson as any)?.formData as DiscoveryFeedbackValues | undefined;
  if (!values) return false;

  return (
    values.firstname?.trim() &&
    values.lastname?.trim() &&
    values.discoveryDate?.trim() &&
    values.discoveryFeedback?.trim() &&
    values.improvementPoints?.trim() &&
    values.continueJourney?.trim() &&
    (values.continueJourney === "non" ? values.stopReason?.trim() : true)
  );
}

export async function sendDiscoveryFollowupAndMappingEmail(params: {
  candidateId: string;
  appointmentId: string;
  actorUserId?: string;
  forceTest?: boolean;
}) {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: params.candidateId },
    include: {
      user: true,
      appointments: true
    }
  });

  const appointment =
    candidate.appointments.find((item) => item.id === params.appointmentId) ??
    (params.forceTest
      ? {
          id: params.appointmentId,
          startDatetime:
            candidate.appointments
              .filter((item) => item.appointmentType === "DISCOVERY_DAY")
              .sort((left, right) => right.startDatetime.getTime() - left.startDatetime.getTime())[0]
              ?.startDatetime ?? new Date()
        }
      : null);

  if (!appointment) {
    return { sent: false, reason: "appointment-not-found" as const };
  }

  const alreadySent = await prisma.eventLog.findFirst({
    where: {
      candidateId: candidate.id,
      actionType: "DISCOVERY_FOLLOWUP_SENT"
    }
  });

  if (alreadySent && !params.forceTest) {
    return { sent: false, reason: "already-sent" as const };
  }

  const { feedbackUrl } = await issueDiscoveryFeedbackAccess({
    candidateId: candidate.id,
    appointmentId: appointment.id,
    appointmentDate: appointment.startDatetime,
    actorUserId: params.actorUserId
  });

  const settings = await getAppSettings();
  const mappingManagerName =
    `${settings.mappingManagerFirstname} ${settings.mappingManagerLastname}`.trim() || "Bonjour";
  const mappingPortalUrl = `${process.env.NEXTAUTH_URL}/mapping/${settings.mappingPortalToken}`;

  await sendTemplatedEmail({
    templateSlug: "candidate-discovery-feedback",
    to: candidate.user.email,
    candidateId: candidate.id,
    senderUserId: params.actorUserId ?? candidate.assignedDevId ?? undefined,
    replacements: {
      firstname: candidate.user.firstname,
      feedbackUrl,
      mappingManagerName,
      mappingManagerFirstname: settings.mappingManagerFirstname || extractFirstname(mappingManagerName),
      mappingManagerPhone: settings.mappingManagerPhone || ""
    }
  });

  if (settings.mappingManagerEmail.trim()) {
    await sendTemplatedEmail({
      templateSlug: "mapping-manager-notification",
      to: settings.mappingManagerEmail,
      candidateId: candidate.id,
      senderUserId: params.actorUserId ?? candidate.assignedDevId ?? undefined,
      replacements: {
        mappingManagerName,
        mappingManagerFirstname: settings.mappingManagerFirstname || extractFirstname(mappingManagerName),
        mappingManagerPhone: settings.mappingManagerPhone || "",
        mappingPortalUrl,
        candidateFullName: `${candidate.user.firstname} ${candidate.user.lastname}`.trim(),
        projectZone: candidate.projectZone || candidate.city,
        projectZipcode: candidate.zipcode || "",
        candidateEmail: candidate.user.email,
        candidatePhone: candidate.user.phone || "Téléphone non renseigné"
      }
    });
  }

  await logEvent({
    actionType: params.forceTest ? "DISCOVERY_FOLLOWUP_TEST_SENT" : "DISCOVERY_FOLLOWUP_SENT",
    candidateId: candidate.id,
    userId: params.actorUserId,
    detailsJson: {
      appointmentId: appointment.id,
      feedbackUrl,
      sentAt: new Date().toISOString()
    }
  });

  return { sent: true as const, feedbackUrl };
}

export async function maybeAdvanceCandidateToDipStep(params: {
  candidateId: string;
  actorUserId?: string;
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.candidateId },
    include: {
      user: true,
      assignedDev: true,
      documents: {
        where: {
          type: "elm"
        },
        orderBy: { uploadedAt: "desc" }
      }
    }
  });

  if (!candidate || candidate.isArchived) {
    return { advanced: false, notified: false, reason: "candidate-not-available" as const };
  }

  const hasFeedback = await isDiscoveryFeedbackComplete(candidate.id);
  const elmDocuments = candidate.documents.filter((document) => document.type === "elm");
  const hasElm = elmDocuments.length > 0;

  if (!hasFeedback || !hasElm) {
    return {
      advanced: false,
      notified: false,
      reason: !hasFeedback ? ("feedback-missing" as const) : ("elm-missing" as const)
    };
  }

  let advanced = false;

  if (candidate.currentStep < 5) {
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        currentStep: 5,
        lastActivityAt: new Date()
      }
    });

    await logEvent({
      actionType: "CANDIDATE_STEP_UPDATED",
      candidateId: candidate.id,
      userId: params.actorUserId,
      detailsJson: {
        previousStep: candidate.currentStep,
        nextStep: 5,
        source: "dip-elm-ready-auto"
      }
    });

    advanced = true;
  }

  const alreadySent = await prisma.eventLog.findFirst({
    where: {
      candidateId: candidate.id,
      actionType: "DIP_SENT_TO_DOCUSIGN"
    }
  });

  if (alreadySent) {
    return { advanced, notified: false, reason: "already-notified" as const };
  }

  const senderUserId =
    params.actorUserId ??
    candidate.assignedDevId ??
    (
      await prisma.user.findFirst({
        where: {
          role: { in: ["ADMIN", "DEV"] },
          isActive: true
        },
        orderBy: { createdAt: "asc" }
      })
    )?.id;

  if (!senderUserId) {
    return { advanced, notified: false, reason: "no-recipient" as const };
  }

  try {
    await sendDipEnvelopeForCandidate({
      candidateId: candidate.id,
      actorUserId: senderUserId
    });
  } catch (error) {
    await logEvent({
      actionType: "DIP_PREPARATION_NOTIFICATION_SENT",
      candidateId: candidate.id,
      userId: senderUserId,
      detailsJson: {
        autoSendFailed: true,
        error: error instanceof Error ? error.message : "Erreur inconnue",
        elmCount: elmDocuments.length
      }
    });

    return { advanced, notified: false, reason: "ready" as const };
  }

  return { advanced, notified: true as const, reason: "ready" as const };
}
