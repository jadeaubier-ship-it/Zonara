import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiRole } from "@/lib/auth/api";

export async function GET() {
  const auth = await requireApiRole(["CANDIDATE"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const candidate = await prisma.candidate.findFirst({
    where: { userId: session.user.id },
    include: { user: true }
  });

  return NextResponse.json(candidate);
}
