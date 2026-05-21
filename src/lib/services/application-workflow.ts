import { isAfter } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { sendTemplatedEmail } from "@/lib/services/email";
import { logEvent } from "@/lib/services/event-log";
import { geocodeFrenchCity } from "@/lib/services/geocoding";
import { validateStep } from "@/lib/services/candidate";
import { generateOnboardingToken, onboardingExpiration } from "@/lib/utils/security";

export const APPLICATION_FIELD_KEYS = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "address",
  "city",
  "zipcode",
  "birthDate",
  "birthPlace",
  "familySituation",
  "childrenCount",
  "profession",
  "professionalSituation",
  "projectZone",
  "projectZipcode",
  "projectDelay",
  "personalContribution",
  "motivation",
  "entrepreneurshipExperience",
  "notes"
] as const;

export const REQUIRED_APPLICATION_FIELD_KEYS = APPLICATION_FIELD_KEYS.filter((key) => key !== "notes") as Array<
  Exclude<(typeof APPLICATION_FIELD_KEYS)[number], "notes">
>;

export type ApplicationFormValues = Record<(typeof APPLICATION_FIELD_KEYS)[number], string>;

export function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function extractApplicationPayload(formData: FormData): ApplicationFormValues {
  return {
    firstname: getString(formData, "firstname"),
    lastname: getString(formData, "lastname"),
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    address: getString(formData, "address"),
    city: getString(formData, "city"),
    zipcode: getString(formData, "zipcode"),
    birthDate: getString(formData, "birthDate"),
    birthPlace: getString(formData, "birthPlace"),
    familySituation: getString(formData, "familySituation"),
    childrenCount: getString(formData, "childrenCount"),
    profession: getString(formData, "profession"),
    professionalSituation: getString(formData, "professionalSituation"),
    projectZone: getString(formData, "projectZone"),
    projectZipcode: getString(formData, "projectZipcode"),
    projectDelay: getString(formData, "projectDelay"),
    personalContribution: getString(formData, "personalContribution"),
    motivation: getString(formData, "motivation"),
    entrepreneurshipExperience: getString(formData, "entrepreneurshipExperience"),
    notes: getString(formData, "notes")
  };
}

export async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

export async function getCandidateByApplicationToken(token: string) {
  const candidate = await prisma.candidate.findFirst({
    where: { onboardingToken: token },
    include: {
      user: true,
      documents: {
        orderBy: { uploadedAt: "desc" }
      },
      eventLogs: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!candidate || !candidate.tokenExpirationDate || isAfter(new Date(), candidate.tokenExpirationDate)) {
    return null;
  }

  return candidate;
}

export function buildApplicationFormValues(candidate: any): ApplicationFormValues {
  const latestFormEvent = candidate?.eventLogs?.find((log: any) => log.actionType === "CANDIDATE_APPLICATION_UPDATED");
  const raw = latestFormEvent?.detailsJson && typeof latestFormEvent.detailsJson === "object" ? (latestFormEvent.detailsJson as any).formData : {};

  return {
    firstname: candidate?.user?.firstname ?? "",
    lastname: candidate?.user?.lastname ?? "",
    email: candidate?.user?.email ?? "",
    phone: candidate?.user?.phone ?? raw?.phone ?? "",
    address: candidate?.address ?? raw?.address ?? "",
    city: candidate?.city ?? raw?.city ?? "",
    zipcode: candidate?.zipcode ?? raw?.zipcode ?? "",
    birthDate: candidate?.birthDate ?? raw?.birthDate ?? "",
    birthPlace: raw?.birthPlace ?? "",
    familySituation: candidate?.familySituation ?? raw?.familySituation ?? "",
    childrenCount: candidate?.childrenCount ?? raw?.childrenCount ?? "",
    profession: candidate?.profession ?? raw?.profession ?? "",
    professionalSituation: candidate?.professionalSituation ?? raw?.professionalSituation ?? "",
    projectZone: candidate?.projectZone ?? raw?.projectZone ?? "",
    projectZipcode: raw?.projectZipcode ?? "",
    projectDelay: candidate?.projectDelay ?? raw?.projectDelay ?? "",
    personalContribution: candidate?.personalContribution ?? raw?.personalContribution ?? "",
    motivation: candidate?.motivation ?? raw?.motivation ?? "",
    entrepreneurshipExperience: candidate?.entrepreneurshipExperience ?? raw?.entrepreneurshipExperience ?? "",
    notes: candidate?.applicationNotes ?? raw?.notes ?? ""
  };
}

export function isApplicationComplete(values: ApplicationFormValues, hasPhoto: boolean, hasCv: boolean) {
  return REQUIRED_APPLICATION_FIELD_KEYS.every((key) => values[key].trim().length > 0) && hasPhoto && hasCv;
}

async function upsertCandidateDocument(params: {
  candidateId: string;
  uploadedById: string;
  type: string;
  stepNumber: number;
  file: File;
}) {
  const fileUrl = await fileToDataUrl(params.file);
  const existing = await prisma.document.findFirst({
    where: {
      candidateId: params.candidateId,
      type: params.type
    },
    orderBy: {
      uploadedAt: "desc"
    }
  });

  if (existing) {
    await prisma.document.update({
      where: { id: existing.id },
      data: {
        fileUrl,
        fileName: params.file.name,
        mimeType: params.file.type,
        uploadedById: params.uploadedById
      }
    });
    return;
  }

  await prisma.document.create({
    data: {
      candidateId: params.candidateId,
      stepNumber: params.stepNumber,
      type: params.type,
      fileUrl,
      fileName: params.file.name,
      mimeType: params.file.type,
      uploadedById: params.uploadedById
    }
  });
}

export async function saveApplicationForm(params: {
  candidate: any;
  payload: ApplicationFormValues;
  actorUserId: string;
  photo?: File | null;
  cv?: File | null;
}) {
  const { candidate, payload, actorUserId, photo, cv } = params;
  const projectLocation = payload.projectZone
    ? await geocodeFrenchCity({
        city: payload.projectZone,
        zipcode: payload.projectZipcode || payload.zipcode || undefined
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: candidate.userId },
      data: {
        firstname: payload.firstname || candidate.user.firstname,
        lastname: payload.lastname || candidate.user.lastname,
        email: payload.email || candidate.user.email,
        phone: payload.phone || null
      }
    });

    await tx.candidate.update({
      where: { id: candidate.id },
      data: {
        address: payload.address || null,
        city: payload.city || candidate.city,
        zipcode: payload.zipcode || null,
        latitude: projectLocation?.latitude ?? candidate.latitude,
        longitude: projectLocation?.longitude ?? candidate.longitude,
        birthDate: payload.birthDate || null,
        familySituation: payload.familySituation || null,
        childrenCount: payload.childrenCount || null,
        profession: payload.profession || null,
        professionalSituation: payload.professionalSituation || null,
        projectZone: payload.projectZone || null,
        projectDelay: payload.projectDelay || null,
        personalContribution: payload.personalContribution || null,
        motivation: payload.motivation || null,
        entrepreneurshipExperience: payload.entrepreneurshipExperience || null,
        applicationNotes: payload.notes || null,
        lastActivityAt: new Date()
      }
    });

    await tx.$executeRaw`
      UPDATE "Candidate"
      SET
        "address" = ${payload.address || null},
        "city" = ${payload.city || candidate.city},
        "zipcode" = ${payload.zipcode || null},
        "latitude" = ${projectLocation?.latitude ?? candidate.latitude},
        "longitude" = ${projectLocation?.longitude ?? candidate.longitude},
        "birthDate" = ${payload.birthDate || null},
        "familySituation" = ${payload.familySituation || null},
        "childrenCount" = ${payload.childrenCount || null},
        "profession" = ${payload.profession || null},
        "professionalSituation" = ${payload.professionalSituation || null},
        "projectZone" = ${payload.projectZone || null},
        "projectDelay" = ${payload.projectDelay || null},
        "personalContribution" = ${payload.personalContribution || null},
        "motivation" = ${payload.motivation || null},
        "entrepreneurshipExperience" = ${payload.entrepreneurshipExperience || null},
        "applicationNotes" = ${payload.notes || null}
      WHERE "id" = ${candidate.id}
    `;
  });

  if (photo instanceof File && photo.size > 0) {
    await upsertCandidateDocument({
      candidateId: candidate.id,
      uploadedById: actorUserId,
      type: "photo_profil",
      stepNumber: 2,
      file: photo
    });
  }

  if (cv instanceof File && cv.size > 0) {
    await upsertCandidateDocument({
      candidateId: candidate.id,
      uploadedById: actorUserId,
      type: "cv",
      stepNumber: 2,
      file: cv
    });
  }
}

export function buildApplicationUrl(token: string) {
  return `${process.env.NEXTAUTH_URL}/dossier/${token}`;
}

export function buildVisioBookingUrl() {
  return process.env.GOOGLE_VISIO_BOOKING_URL ?? `${process.env.NEXTAUTH_URL}/visio-en-attente`;
}

export async function issueApplicationAccess(candidateId: string) {
  const onboardingToken = generateOnboardingToken();
  const tokenExpirationDate = onboardingExpiration();

  const candidate = await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      onboardingToken,
      tokenExpirationDate
    },
    include: {
      user: true
    }
  });

  return {
    candidate,
    onboardingToken,
    tokenExpirationDate,
    applicationUrl: buildApplicationUrl(onboardingToken)
  };
}

export async function sendApplicationInvitationEmail(
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
  const { candidate, applicationUrl } = await issueApplicationAccess(candidateId);

  await sendTemplatedEmail({
    templateSlug: "candidate-application-invitation",
    to: candidate.user.email,
    candidateId: candidate.id,
    senderUserId,
    subjectOverride: overrides?.subject,
    bodyTextOverride: overrides?.bodyText,
    attachmentsOverride: overrides?.attachments,
    replacements: {
      firstname: candidate.user.firstname,
      applicationUrl
    }
  });

  await logEvent({
    actionType: "CANDIDATE_APPLICATION_INVITED",
    candidateId: candidate.id,
    detailsJson: {
      applicationUrl
    }
  });
}

export async function finalizeApplicationIfComplete(params: {
  candidateId: string;
  actorUserId?: string;
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.candidateId },
    include: {
      user: true,
      documents: true,
      eventLogs: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!candidate) {
    return { advanced: false };
  }

  const values = buildApplicationFormValues(candidate);
  const hasPhoto = candidate.documents.some((document) => document.type === "photo_profil" && Boolean(document.fileUrl));
  const hasCv = candidate.documents.some((document) => document.type === "cv" && Boolean(document.fileUrl));

  if (!isApplicationComplete(values, hasPhoto, hasCv) || candidate.currentStep !== 2) {
    return { advanced: false };
  }

  await validateStep({
    candidateId: candidate.id,
    stepNumber: 2,
    userId: params.actorUserId
  });

  const refreshedCandidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidate.id },
    include: { user: true }
  });
  const senderUserId =
    candidate.assignedDevId ??
    (
      await prisma.user.findFirst({
        where: {
          role: { in: ["ADMIN", "DEV"] }
        },
        orderBy: { createdAt: "asc" }
      })
    )?.id;

  const bookingUrl = buildVisioBookingUrl();

  await sendTemplatedEmail({
    templateSlug: "candidate-application-visio",
    to: refreshedCandidate.user.email,
    candidateId: refreshedCandidate.id,
    senderUserId,
    replacements: {
      firstname: refreshedCandidate.user.firstname,
      bookingUrl
    }
  });

  await logEvent({
    actionType: "CANDIDATE_APPLICATION_COMPLETED",
    candidateId: refreshedCandidate.id,
    userId: params.actorUserId,
    detailsJson: {
      bookingUrl
    }
  });

  return {
    advanced: true,
    bookingUrl
  };
}
