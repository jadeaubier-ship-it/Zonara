import { NextRequest, NextResponse } from "next/server";
import { autoAdvanceAfterPayment } from "@/lib/services/candidate";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const candidateId = String(body.data?.object?.metadata?.candidateId ?? body.candidateId);
  const paymentId = String(body.data?.object?.id ?? body.paymentId ?? "mock-payment");

  if (candidateId) {
    await autoAdvanceAfterPayment(candidateId, paymentId);
  }

  return NextResponse.json({ received: true });
}
