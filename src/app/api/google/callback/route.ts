import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import {
  exchangeGoogleCodeForTokens,
  getGoogleUserInfo,
  isGoogleCalendarConfigured
} from "@/lib/integrations/google-oauth";
import { getAppSettings } from "@/lib/services/settings-store";

const APP_BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/admin/settings?google=missing-config", APP_BASE_URL));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = request.cookies.get("google_oauth_state")?.value;

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/settings?google=error&detail=${encodeURIComponent(error)}`, APP_BASE_URL)
    );
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/admin/settings?google=invalid-state", APP_BASE_URL));
  }

  try {
    const settings = await getAppSettings();
    const tokenData = await exchangeGoogleCodeForTokens(code);
    const profile = await getGoogleUserInfo(tokenData.access_token);
    const expectedEmail = extractEmailAddress(settings.senderEmail);
    const actualEmail = profile.email.trim().toLowerCase();

    if (actualEmail !== expectedEmail) {
      return NextResponse.redirect(
        new URL(
          `/admin/settings?google=wrong-account&detail=${encodeURIComponent(profile.email)}`,
          APP_BASE_URL
        )
      );
    }

    const existing = await prisma.googleAccount.findUnique({
      where: { userId: auth.session!.user.id }
    });

    const refreshToken = tokenData.refresh_token || existing?.googleRefreshToken;

    if (!refreshToken) {
      return NextResponse.redirect(new URL("/admin/settings?google=missing-refresh-token", APP_BASE_URL));
    }

    await prisma.googleAccount.upsert({
      where: { userId: auth.session!.user.id },
      update: {
        googleRefreshToken: refreshToken,
        googleCalendarId: actualEmail
      },
      create: {
        userId: auth.session!.user.id,
        googleRefreshToken: refreshToken,
        googleCalendarId: actualEmail
      }
    });

    const response = NextResponse.redirect(new URL("/admin/settings?google=connected", APP_BASE_URL));
    response.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: APP_BASE_URL.startsWith("https://"),
      path: "/",
      maxAge: 0
    });
    return response;
  } catch (cause) {
    const detail =
      cause instanceof Error ? cause.message : "Connexion Google Calendar impossible.";
    return NextResponse.redirect(
      new URL(`/admin/settings?google=failed&detail=${encodeURIComponent(detail)}`, APP_BASE_URL)
    );
  }
}
