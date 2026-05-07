import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: { user: true }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });
  }

  const formData = await request.formData();
  const photo = formData.get("photo");
  const cv = formData.get("cv");

  const payload = {
    firstname: getString(formData, "firstname"),
    lastname: getString(formData, "lastname"),
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    address: getString(formData, "address"),
    city: getString(formData, "city"),
    zipcode: getString(formData, "zipcode"),
    birthDate: getString(formData, "birthDate"),
    familySituation: getString(formData, "familySituation"),
    childrenCount: getString(formData, "childrenCount"),
    profession: getString(formData, "profession"),
    professionalSituation: getString(formData, "professionalSituation"),
    projectZone: getString(formData, "projectZone"),
    projectDelay: getString(formData, "projectDelay"),
    personalContribution: getString(formData, "personalContribution"),
    motivation: getString(formData, "motivation"),
    entrepreneurshipExperience: getString(formData, "entrepreneurshipExperience"),
    notes: getString(formData, "notes")
  };

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
      where: { id: params.id },
      data: {
        address: payload.address || null,
        city: payload.city || candidate.city,
        zipcode: payload.zipcode || null,
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
      WHERE "id" = ${params.id}
    `;

    if (photo instanceof File && photo.size > 0) {
      const fileUrl = await fileToDataUrl(photo);
      const existingPhoto = await tx.document.findFirst({
        where: {
          candidateId: params.id,
          type: "photo_profil"
        },
        orderBy: {
          uploadedAt: "desc"
        }
      });

      if (existingPhoto) {
        await tx.document.update({
          where: { id: existingPhoto.id },
          data: {
            fileUrl,
            fileName: photo.name,
            mimeType: photo.type,
            uploadedById: session.user.id
          }
        });
      } else {
        await tx.document.create({
          data: {
            candidateId: params.id,
            stepNumber: 2,
            type: "photo_profil",
            fileUrl,
            fileName: photo.name,
            mimeType: photo.type,
            uploadedById: session.user.id
          }
        });
      }
    }

    if (cv instanceof File && cv.size > 0) {
      const fileUrl = await fileToDataUrl(cv);
      const existingCv = await tx.document.findFirst({
        where: {
          candidateId: params.id,
          type: "cv"
        },
        orderBy: {
          uploadedAt: "desc"
        }
      });

      if (existingCv) {
        await tx.document.update({
          where: { id: existingCv.id },
          data: {
            fileUrl,
            fileName: cv.name,
            mimeType: cv.type,
            uploadedById: session.user.id
          }
        });
      } else {
        await tx.document.create({
          data: {
            candidateId: params.id,
            stepNumber: 2,
            type: "cv",
            fileUrl,
            fileName: cv.name,
            mimeType: cv.type,
            uploadedById: session.user.id
          }
        });
      }
    }
  });

  try {
    await logEvent({
      actionType: "CANDIDATE_APPLICATION_UPDATED",
      candidateId: params.id,
      userId: session.user.id,
      detailsJson: {
        formData: payload,
        photoUpdated: photo instanceof File && photo.size > 0,
        cvUpdated: cv instanceof File && cv.size > 0
      } as any
    });
  } catch {
    // Ne bloque pas l'enregistrement du dossier si l'historique échoue.
  }

  return NextResponse.json({ success: true });
}
