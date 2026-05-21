import { CandidatesTable } from "@/components/admin/candidates-table";
import { getCandidateList } from "@/lib/services/candidate";

export const dynamic = "force-dynamic";

export default async function AdminArchivedCandidatesPage() {
  const candidates = await getCandidateList({ includeArchived: true });

  const archivedCandidates = candidates
    .filter((candidate) => candidate.isArchived)
    .sort((a, b) => Number(new Date(b.archivedAt ?? b.updatedAt)) - Number(new Date(a.archivedAt ?? a.updatedAt)));

  return <CandidatesTable candidates={archivedCandidates as any} />;
}
