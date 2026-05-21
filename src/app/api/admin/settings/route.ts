import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import {
  buildDefaultSignature,
  getAppSettings,
  resolveUserProfile,
  saveAppSettings
} from "@/lib/services/settings-store";

export async function GET() {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const settings = await getAppSettings();
  const session = auth.session!;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }
  const profile = resolveUserProfile({
    settings,
    user: {
      id: dbUser.id,
      firstname: dbUser.firstname,
      lastname: dbUser.lastname,
      email: dbUser.email,
      phone: dbUser.phone ?? "",
      role: dbUser.role
    }
  });
  const superAdminUserId = settings.superAdminUserId || dbUser.id;
  const superAdminName =
    settings.superAdminName || `${dbUser.firstname} ${dbUser.lastname}`.trim();
  const superAdminEmail = settings.superAdminEmail || dbUser.email;

  return NextResponse.json({
    brandName: settings.brandName,
    senderEmail: settings.senderEmail,
    brandLogoDataUrl: settings.brandLogoDataUrl,
    superAdminUserId,
    superAdminName,
    superAdminEmail,
    mappingManagerFirstname: settings.mappingManagerFirstname,
    mappingManagerLastname: settings.mappingManagerLastname,
    mappingManagerEmail: settings.mappingManagerEmail,
    mappingManagerPhone: settings.mappingManagerPhone,
    mappingPortalToken: settings.mappingPortalToken,
    currentUserSignature: buildDefaultSignature({
      firstname: profile.firstname,
      lastname: profile.lastname,
      brandName: settings.brandName,
      senderEmail: settings.senderEmail,
      professionalRole: profile.professionalRole,
      professionalPhone: profile.professionalPhone,
      professionalEmail: profile.professionalEmail
    }),
    currentUserProfile: profile
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const session = auth.session!;
  const body = (await request.json()) as {
    brandName?: string;
    senderEmail?: string;
    brandLogoDataUrl?: string;
    superAdminName?: string;
    superAdminEmail?: string;
    mappingManagerFirstname?: string;
    mappingManagerLastname?: string;
    mappingManagerEmail?: string;
    mappingManagerPhone?: string;
    currentUserProfile?: {
      firstname?: string;
      lastname?: string;
      professionalEmail?: string;
      professionalPhone?: string;
      professionalRole?: string;
      photoDataUrl?: string;
      newPassword?: string;
    };
  };

  const current = await getAppSettings();
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  });
  if (!dbUser) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }
  const superAdminUserId = current.superAdminUserId || dbUser.id;
  const isSuperAdmin = session.user.id === superAdminUserId;
  const currentProfile = resolveUserProfile({
    settings: current,
    user: {
      id: dbUser.id,
      firstname: dbUser.firstname,
      lastname: dbUser.lastname,
      email: dbUser.email,
      phone: dbUser.phone ?? "",
      role: dbUser.role
    }
  });
  const hasUserProfileUpdate = Boolean(body.currentUserProfile);

  let nextProfile = currentProfile;

  if (hasUserProfileUpdate) {
    const nextUserEmail =
      body.currentUserProfile?.professionalEmail?.trim() || currentProfile.professionalEmail;
    const nextUserFirstname = body.currentUserProfile?.firstname?.trim() || currentProfile.firstname;
    const nextUserLastname = body.currentUserProfile?.lastname?.trim() || currentProfile.lastname;
    const nextUserPhone =
      body.currentUserProfile?.professionalPhone?.trim() || currentProfile.professionalPhone;
    const nextPassword = body.currentUserProfile?.newPassword?.trim() || "";

    if (nextPassword && nextPassword.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
    }

    const emailConflict =
      nextUserEmail.toLowerCase() !== dbUser.email.toLowerCase()
        ? await prisma.user.findFirst({
            where: {
              email: {
                equals: nextUserEmail,
                mode: "insensitive"
              },
              id: { not: dbUser.id }
            }
          })
        : null;

    if (emailConflict) {
      return NextResponse.json({ error: "Cette adresse mail est déjà utilisée." }, { status: 409 });
    }

    const userUpdateData: {
      firstname: string;
      lastname: string;
      email: string;
      phone: string | null;
      password?: string;
    } = {
      firstname: nextUserFirstname,
      lastname: nextUserLastname,
      email: nextUserEmail,
      phone: nextUserPhone || null
    };

    if (nextPassword) {
      userUpdateData.password = await bcrypt.hash(nextPassword, 12);
    }

    await prisma.user.update({
      where: { id: dbUser.id },
      data: userUpdateData
    });

    nextProfile = {
      firstname: nextUserFirstname,
      lastname: nextUserLastname,
      professionalEmail: nextUserEmail,
      professionalPhone: nextUserPhone,
      professionalRole:
        body.currentUserProfile?.professionalRole?.trim() || currentProfile.professionalRole,
      photoDataUrl: body.currentUserProfile?.photoDataUrl?.trim() || currentProfile.photoDataUrl
    };
  }

  const next = {
    brandName: isSuperAdmin ? body.brandName?.trim() || current.brandName : current.brandName,
    senderEmail: isSuperAdmin ? body.senderEmail?.trim() || current.senderEmail : current.senderEmail,
    brandLogoDataUrl:
      isSuperAdmin
        ? body.brandLogoDataUrl !== undefined
          ? body.brandLogoDataUrl.trim()
          : current.brandLogoDataUrl
        : current.brandLogoDataUrl,
    superAdminUserId,
    superAdminName: isSuperAdmin
      ? body.superAdminName?.trim() || current.superAdminName || `${dbUser.firstname} ${dbUser.lastname}`.trim()
      : current.superAdminName || `${dbUser.firstname} ${dbUser.lastname}`.trim(),
    superAdminEmail: isSuperAdmin
      ? body.superAdminEmail?.trim() || current.superAdminEmail || dbUser.email
      : current.superAdminEmail || dbUser.email,
    mappingManagerFirstname:
      body.mappingManagerFirstname !== undefined
        ? body.mappingManagerFirstname.trim()
        : current.mappingManagerFirstname,
    mappingManagerLastname:
      body.mappingManagerLastname !== undefined
        ? body.mappingManagerLastname.trim()
        : current.mappingManagerLastname,
    mappingManagerEmail:
      body.mappingManagerEmail !== undefined ? body.mappingManagerEmail.trim() : current.mappingManagerEmail,
    mappingManagerPhone:
      body.mappingManagerPhone !== undefined ? body.mappingManagerPhone.trim() : current.mappingManagerPhone,
    mappingPortalToken: current.mappingPortalToken,
    userSignatures: hasUserProfileUpdate
      ? {
          ...current.userSignatures,
          [session.user.id]: buildDefaultSignature({
            firstname: nextProfile.firstname,
            lastname: nextProfile.lastname,
            brandName: body.brandName?.trim() || current.brandName,
            senderEmail: body.senderEmail?.trim() || current.senderEmail,
            professionalRole: nextProfile.professionalRole,
            professionalPhone: nextProfile.professionalPhone,
            professionalEmail: nextProfile.professionalEmail
          })
        }
      : current.userSignatures,
    userProfiles: hasUserProfileUpdate
      ? {
          ...current.userProfiles,
          [session.user.id]: nextProfile
        }
      : current.userProfiles
  };

  const saved = await saveAppSettings(next);

  return NextResponse.json({
    brandName: saved.brandName,
    senderEmail: saved.senderEmail,
    brandLogoDataUrl: saved.brandLogoDataUrl,
    superAdminUserId: saved.superAdminUserId,
    superAdminName: saved.superAdminName,
    superAdminEmail: saved.superAdminEmail,
    mappingManagerFirstname: saved.mappingManagerFirstname,
    mappingManagerLastname: saved.mappingManagerLastname,
    mappingManagerEmail: saved.mappingManagerEmail,
    mappingManagerPhone: saved.mappingManagerPhone,
    mappingPortalToken: saved.mappingPortalToken,
    currentUserSignature: saved.userSignatures[session.user.id],
    currentUserProfile: saved.userProfiles[session.user.id]
  });
}
