import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getCandidateDetails } from "@/lib/services/candidate";
import { buildCandidatePdfPayload } from "@/lib/utils/export";

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const candidateId = new URL(request.url).searchParams.get("candidateId");

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId manquant" }, { status: 400 });
  }

  const candidate = await getCandidateDetails(candidateId);

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable" }, { status: 404 });
  }

  const payload = buildCandidatePdfPayload(candidate);

  return NextResponse.json(payload);
}
