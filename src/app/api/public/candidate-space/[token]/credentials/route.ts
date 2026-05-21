import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const email = body.email?.trim() || "";
  const password = body.password?.trim() || "";

  if (!email) {
    return NextResponse.json({ error: "L'identifiant de connexion est obligatoire." }, { status: 400 });
  }

  if (password && password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
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

  const updateData: {
    email: string;
    password?: string;
  } = {
    email
  };

  if (password) {
    updateData.password = await bcrypt.hash(password, 12);
  }

  await prisma.user.update({
    where: { id: candidate.user.id },
    data: updateData
  });

  return NextResponse.json({
    email
  });
}
