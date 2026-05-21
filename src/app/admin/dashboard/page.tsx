import nextDynamic from "next/dynamic";
import { CandidatesTable } from "@/components/admin/candidates-table";
import { DashboardStats } from "@/components/admin/dashboard-stats";
import { prisma } from "@/lib/db/prisma";
import { getCandidateList } from "@/lib/services/candidate";
import { getStepDeadlineDays } from "@/lib/utils/deadlines";

export const dynamic = "force-dynamic";

const FranceMap = nextDynamic(() => import("@/components/maps/france-map").then((mod) => mod.FranceMap), {
  ssr: false
});

export default async function AdminDashboardPage() {
  const [candidates, franchisees] = await Promise.all([
    getCandidateList({ includeArchived: true }),
    prisma.franchisee.findMany({ include: { user: true } })
  ]);

  const archivedCandidates = candidates.filter((candidate) => candidate.isArchived);

  const activeCandidates = candidates
    .filter((candidate) => !candidate.isArchived)
    .filter((candidate) => !["WON", "LOST"].includes(candidate.statusGlobal))
    .sort((a, b) => a.currentStep - b.currentStep || a.inactivityDays - b.inactivityDays);

  const dipInProgressCount = activeCandidates.filter((candidate) => candidate.currentStep === 5).length;
  const contractsPendingSignatureCount = activeCandidates.filter((candidate) => candidate.currentStep === 8).length;

  const reminderCandidates = activeCandidates
    .filter((candidate) => candidate.inactivityDays > getStepDeadlineDays(candidate.currentStep))
    .map((candidate) => ({
      id: candidate.id,
      firstname: candidate.user.firstname,
      lastname: candidate.user.lastname,
      city: candidate.city,
      currentStep: candidate.currentStep,
      inactivityDays: candidate.inactivityDays,
      deadlineDays: getStepDeadlineDays(candidate.currentStep)
    }));

  const reminderCandidateRows = activeCandidates
    .filter((candidate) => candidate.inactivityDays > getStepDeadlineDays(candidate.currentStep))
    .sort(
      (a, b) =>
        a.currentStep - b.currentStep ||
        (b.inactivityDays - getStepDeadlineDays(b.currentStep)) - (a.inactivityDays - getStepDeadlineDays(a.currentStep))
    );

  const points = [
    ...franchisees
      .filter((item) => item.latitude && item.longitude)
      .map((item) => ({
        id: item.id,
        label: `${item.user.firstname} ${item.user.lastname} - ${item.city}`,
        latitude: item.latitude!,
        longitude: item.longitude!,
        type: "Franchisé"
      })),
    ...activeCandidates
      .filter((item) => item.latitude && item.longitude)
      .map((item) => ({
        id: item.id,
        label: `${item.user.firstname} ${item.user.lastname} - ${item.city}${item.zipcode ? ` (${item.zipcode})` : ""}`,
        latitude: item.latitude!,
        longitude: item.longitude!,
        type: "Candidat",
        href: `/admin/candidates/${item.id}`
      }))
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <FranceMap points={points} />
        <DashboardStats
          franchiseesCount={franchisees.length}
          activeCandidatesCount={activeCandidates.length}
          archivedCandidatesCount={archivedCandidates.length}
          dipInProgressCount={dipInProgressCount}
          contractsPendingSignatureCount={contractsPendingSignatureCount}
          reminderCandidates={reminderCandidates}
        />
      </div>
      <CandidatesTable candidates={reminderCandidateRows as any} showCreateRow={false} />
    </div>
  );
}
