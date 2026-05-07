import { NextResponse } from "next/server";
import { getAvailability } from "@/lib/integrations/google-calendar";
import { requireApiRole } from "@/lib/auth/api";

export async function GET() {
  const auth = await requireApiRole(["ADMIN", "DEV", "CANDIDATE"]);
  if (auth.unauthorized) return auth.unauthorized;

  const slots = await getAvailability();

  return NextResponse.json(slots);
}
