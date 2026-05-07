import { NextRequest, NextResponse } from "next/server";
import { CandidateStatusGlobal, Prisma } from "@prisma/client";
import { createCandidate, getCandidateList } from "@/lib/services/candidate";
import { createCandidateSchema } from "@/lib/utils/validators";
import { requireApiRole } from "@/lib/auth/api";

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const { searchParams } = new URL(request.url);
  const candidates = await getCandidateList({
    assignedDevId: searchParams.get("assignedDevId") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    statusGlobal: (searchParams.get("statusGlobal") as CandidateStatusGlobal | null) ?? undefined,
    step: searchParams.get("step") ? Number(searchParams.get("step")) : undefined,
    inactivityDays: searchParams.get("inactivityDays") ? Number(searchParams.get("inactivityDays")) : undefined
  });

  return NextResponse.json(candidates);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const contentType = request.headers.get("content-type") ?? "";
  const payload =
    contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());

  const parsed = createCandidateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const candidate = await createCandidate({
      ...parsed.data,
      createdAt: parsed.data.createdAt ? String(parsed.data.createdAt).trim() || undefined : undefined,
      phone: parsed.data.phone ? String(parsed.data.phone).trim() || undefined : undefined,
      address: parsed.data.address ? String(parsed.data.address).trim() || undefined : undefined,
      zipcode: parsed.data.zipcode ? String(parsed.data.zipcode).trim() || undefined : undefined,
      source: parsed.data.source ? String(parsed.data.source).trim() || undefined : undefined,
      comment: parsed.data.comment ? String(parsed.data.comment).trim() || undefined : undefined,
      assignedDevId: parsed.data.assignedDevId ? String(parsed.data.assignedDevId).trim() || undefined : undefined,
      createdById: session.user.id
    });

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Un candidat avec cet email existe deja." }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
