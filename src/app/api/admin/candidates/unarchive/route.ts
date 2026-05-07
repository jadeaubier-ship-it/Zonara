import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { unarchiveCandidate } from "@/lib/services/candidate";

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const body = (await request.json()) as { candidateId?: string };

  if (!body.candidateId) {
    return NextResponse.json({ error: "Aucun candidat sélectionné." }, { status: 400 });
  }

  await unarchiveCandidate(body.candidateId, session.user.id);

  return NextResponse.json({ success: true });
}
