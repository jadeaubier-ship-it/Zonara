import { NextResponse } from "next/server";
import { runDailyAutomation } from "@/lib/services/automation";

export async function GET() {
  await runDailyAutomation();
  return NextResponse.json({ success: true, executedAt: new Date().toISOString() });
}
