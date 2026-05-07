import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { validateStep } from "@/lib/services/candidate";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const envelopeId = String(body.envelopeId);
  const status = String(body.status ?? "COMPLETED").toLowerCase();

  const envelope = await prisma.docuSignEnvelope.update({
    where: { envelopeId },
    data: { status: status === "completed" ? "COMPLETED" : "DELIVERED" }
  });

  if (status === "completed") {
    await validateStep({
      candidateId: envelope.candidateId,
      stepNumber: envelope.stepNumber,
      userId: undefined
    });
  }

  return NextResponse.json({ success: true });
}
