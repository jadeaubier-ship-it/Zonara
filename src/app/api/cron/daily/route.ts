import { NextResponse } from "next/server";
import { runDailyAutomation } from "@/lib/services/automation";
import { runDiscoveryFollowupCron, syncGoogleCalendarVisios } from "@/lib/integrations/google-calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  const automation = await runDailyAutomation();
  const googleCalendar = await syncGoogleCalendarVisios().catch((error) => ({
    synced: false,
    created: 0,
    updated: 0,
    error: error instanceof Error ? error.message : "Synchronisation Google Calendar impossible."
  }));
  const discoveryFollowup = await runDiscoveryFollowupCron().catch((error) => ({
    sent: 0,
    error: error instanceof Error ? error.message : "Envoi J+1 impossible."
  }));

  return NextResponse.json({
    success: true,
    executedAt: new Date().toISOString(),
    automation,
    googleCalendar,
    discoveryFollowup
  });
}
