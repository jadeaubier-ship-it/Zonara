import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";

export async function requireApiRole(roles: string[]) {
  const session = await getAuthSession();

  if (!session?.user) {
    return {
      session: null,
      unauthorized: NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    };
  }

  if (!roles.includes(session.user.role)) {
    return {
      session,
      unauthorized: NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    };
  }

  return { session, unauthorized: null };
}
