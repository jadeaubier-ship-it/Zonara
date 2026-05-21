import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { createGoogleOAuthUrl, isGoogleCalendarConfigured } from "@/lib/integrations/google-oauth";

const APP_BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function GET() {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/admin/settings?google=missing-config", APP_BASE_URL));
  }

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(createGoogleOAuthUrl(state));
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: APP_BASE_URL.startsWith("https://"),
    path: "/",
    maxAge: 60 * 10
  });

  return response;
}
