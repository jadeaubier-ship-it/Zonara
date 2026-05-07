import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/config";

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();

  if (!roles.includes(session.user.role)) {
    redirect(session.user.redirectTo ?? "/login");
  }

  return session;
}
