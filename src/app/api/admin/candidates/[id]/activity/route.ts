import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getCandidateActivity } from "@/lib/services/candidate-activity";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const activity = await getCandidateActivity(params.id);

  if (!activity) {
    return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });
  }

  return NextResponse.json(activity);
}
