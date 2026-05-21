import { NextRequest, NextResponse } from "next/server";
import {
  buildDiscoveryFeedbackValues,
  DISCOVERY_FEEDBACK_FIELD_KEYS,
  getCandidateByDiscoveryFeedbackToken,
  saveDiscoveryFeedback
} from "@/lib/services/discovery-workflow";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const match = await getCandidateByDiscoveryFeedbackToken(params.token);

  if (!match) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
  }

  return NextResponse.json({
    candidate: {
      id: match.candidate.id,
      firstname: match.candidate.user.firstname,
      lastname: match.candidate.user.lastname
    },
    values: buildDiscoveryFeedbackValues(match.candidate, match.invitationLog)
  });
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const match = await getCandidateByDiscoveryFeedbackToken(params.token);

  if (!match) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
  }

  const formData = await request.formData();
  const values = Object.fromEntries(
    DISCOVERY_FEEDBACK_FIELD_KEYS.map((key) => [key, getString(formData, key)])
  ) as Record<(typeof DISCOVERY_FEEDBACK_FIELD_KEYS)[number], string>;

  const missing = DISCOVERY_FEEDBACK_FIELD_KEYS.find((key) => {
    if (key === "stopReason" && values.continueJourney !== "non") {
      return false;
    }
    return !values[key]?.trim();
  });

  if (missing) {
    return NextResponse.json({ error: "Merci de remplir tous les champs obligatoires." }, { status: 400 });
  }

  await saveDiscoveryFeedback({
    candidateId: match.candidate.id,
    actorUserId: match.candidate.userId,
    values
  });

  return NextResponse.json({ success: true });
}
