import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { rejectStep } from "@/lib/services/candidate";
import { stepActionSchema } from "@/lib/utils/validators";

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const payload = await request.json();
  const parsed = stepActionSchema.safeParse(payload);

  if (!parsed.success || !parsed.data.comment) {
    return NextResponse.json({ error: "Commentaire obligatoire" }, { status: 400 });
  }

  await rejectStep({
    candidateId: parsed.data.candidateId,
    stepNumber: parsed.data.stepNumber,
    comment: parsed.data.comment,
    userId: session.user.id
  });

  return NextResponse.json({ success: true });
}
