import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { archiveCandidates } from "@/lib/services/candidate";

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const body = (await request.json()) as { candidateIds?: string[] };
  const candidateIds = Array.isArray(body.candidateIds) ? body.candidateIds.filter(Boolean) : [];

  if (!candidateIds.length) {
    return NextResponse.json({ error: "Aucun candidat sélectionné." }, { status: 400 });
  }

  const result = await archiveCandidates(candidateIds, session.user.id);

  return NextResponse.json({ success: true, count: result.count });
}
