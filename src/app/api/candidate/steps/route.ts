import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiRole } from "@/lib/auth/api";

export async function GET() {
  const auth = await requireApiRole(["CANDIDATE"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { userId: session.user.id },
    include: { steps: { orderBy: { stepNumber: "asc" } } }
  });

  return NextResponse.json(candidate.steps);
}
