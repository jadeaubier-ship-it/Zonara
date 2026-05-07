import { CandidatesTable } from "@/components/admin/candidates-table";
import { getCandidateList } from "@/lib/services/candidate";

export default async function AdminCandidatesPage() {
  const candidates = await getCandidateList({});

  const activeCandidates = candidates
    .filter((candidate) => !["WON", "LOST"].includes(candidate.statusGlobal))
    .sort((a, b) => a.currentStep - b.currentStep || a.inactivityDays - b.inactivityDays);

  return <CandidatesTable candidates={activeCandidates as any} />;
}
