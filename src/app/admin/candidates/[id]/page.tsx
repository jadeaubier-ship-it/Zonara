import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/admin/archive-button";
import { UnarchiveButton } from "@/components/admin/unarchive-button";
import { Badge } from "@/components/ui/badge";
import { CandidateFile } from "@/components/admin/candidate-file";
import { getCandidateDetails } from "@/lib/services/candidate";

export default async function CandidatePage({ params }: { params: { id: string } }) {
  const candidate = await getCandidateDetails(params.id);

  if (!candidate) {
    notFound();
  }

  return (
    <div className={candidate.isArchived ? "space-y-6 rounded-[2rem] bg-gradient-to-br from-rose-50 via-red-50 to-white p-6 pt-14" : "space-y-6 pt-10"}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-950">
            {candidate.user.firstname} {candidate.user.lastname}
          </h2>
          <p className="text-sm text-slate-500">
            {candidate.user.email} · {candidate.city}
          </p>
          {candidate.isArchived ? (
            <div className="mt-3">
              <Badge variant="red">Candidat archivé</Badge>
            </div>
          ) : null}
        </div>
        {candidate.isArchived ? <UnarchiveButton candidateId={candidate.id} /> : <ArchiveButton candidateId={candidate.id} />}
      </div>
      <div className="mt-6">
        <CandidateFile candidate={candidate} archived={candidate.isArchived} />
      </div>
    </div>
  );
}
