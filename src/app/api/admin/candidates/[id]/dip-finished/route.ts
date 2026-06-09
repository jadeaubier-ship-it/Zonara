import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { completeDipLegalDelayForCandidate } from "@/lib/services/automation";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  try {
    const result = await completeDipLegalDelayForCandidate(params.id, auth.session?.user.id);
    return NextResponse.json({
      success: true,
      alreadyCompleted: result.alreadyCompleted
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de simuler la fin du délai DIP." },
      { status: 400 }
    );
  }
}
