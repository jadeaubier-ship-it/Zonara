import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { sendDipEnvelopeForCandidate } from "@/lib/services/dip-send";

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const body = await request.json();
  const candidateId = String(body.candidateId);
  const forceResend = Boolean(body.forceResend);

  try {
    const record = await sendDipEnvelopeForCandidate({
      candidateId,
      actorUserId: session.user.id,
      forceResend
    });
    return NextResponse.json(record);
  } catch (error) {
    console.error("[DocuSign] send-envelope failed", {
      candidateId,
      forceResend,
      userId: session.user.id,
      error
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'envoyer le DIP via DocuSign." },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Utilisez POST pour créer une enveloppe DocuSign."
  });
}
