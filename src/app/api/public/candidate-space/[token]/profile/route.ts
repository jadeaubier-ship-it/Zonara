import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = (await request.json()) as {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    photoDataUrl?: string;
  };

  const firstname = body.firstname?.trim() || "";
  const lastname = body.lastname?.trim() || "";
  const email = body.email?.trim() || "";
  const phone = body.phone?.trim() || "";
  const photoDataUrl = body.photoDataUrl?.trim() || "";

  if (!firstname || !lastname || !email) {
    return NextResponse.json({ error: "Prénom, nom et mail sont obligatoires." }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: { onboardingToken: params.token },
    include: { user: true }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Lien candidat invalide." }, { status: 404 });
  }

  const emailConflict =
    email.toLowerCase() !== candidate.user.email.toLowerCase()
      ? await prisma.user.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive"
            },
            id: { not: candidate.user.id }
          }
        })
      : null;

  if (emailConflict) {
    return NextResponse.json({ error: "Cette adresse mail est déjà utilisée." }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: candidate.user.id },
    data: {
      firstname,
      lastname,
      email,
      phone: phone || null
    }
  });

  if (photoDataUrl) {
    const existingPhoto = await prisma.document.findFirst({
      where: {
        candidateId: candidate.id,
        type: "photo_profil"
      },
      orderBy: { uploadedAt: "desc" }
    });

    if (existingPhoto) {
      await prisma.document.update({
        where: { id: existingPhoto.id },
        data: {
          fileUrl: photoDataUrl,
          fileName: "photo-profil.jpg",
          mimeType: "image/jpeg",
          uploadedById: candidate.user.id
        }
      });
    } else {
      await prisma.document.create({
        data: {
          candidateId: candidate.id,
          type: "photo_profil",
          fileUrl: photoDataUrl,
          fileName: "photo-profil.jpg",
          mimeType: "image/jpeg",
          uploadedById: candidate.user.id
        }
      });
    }
  }

  return NextResponse.json({
    firstname,
    lastname,
    email,
    phone,
    photoDataUrl
  });
}
