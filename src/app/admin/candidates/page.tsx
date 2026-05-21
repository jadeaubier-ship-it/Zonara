import { CandidatesTable } from "@/components/admin/candidates-table";
import { getCandidateList } from "@/lib/services/candidate";
import { syncGoogleCalendarVisios } from "@/lib/integrations/google-calendar";

export const dynamic = "force-dynamic";

export default async function AdminCandidatesPage() {
  try {
    await syncGoogleCalendarVisios();
  } catch (error) {
    console.error("Google Calendar sync failed:", error);
  }

  const candidates = await getCandidateList({});

  const activeCandidates = candidates
    .filter((candidate) => !["WON", "LOST"].includes(candidate.statusGlobal))
    .sort((a, b) => a.currentStep - b.currentStep || a.inactivityDays - b.inactivityDays);

  return <CandidatesTable candidates={activeCandidates as any} />;
}
