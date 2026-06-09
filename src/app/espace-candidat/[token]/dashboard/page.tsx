import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { getCandidatePortalCandidate } from "@/lib/services/candidate-portal";

const FranceMap = dynamic(() => import("@/components/maps/france-map").then((mod) => mod.FranceMap), {
  ssr: false
});

export default async function CandidatePortalDashboardPage({
  params
}: {
  params: { token: string };
}) {
  await getCandidatePortalCandidate(params.token);
  const franchisees = await prisma.franchisee.findMany({
    include: { user: true }
  });

  const points = franchisees
    .filter((item) => item.latitude && item.longitude)
    .map((item) => ({
      id: item.id,
      label: `${item.user.firstname} ${item.user.lastname} - ${item.city}`,
      latitude: item.latitude!,
      longitude: item.longitude!,
      type: "Franchisé"
    }));

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h1 className="text-xl font-semibold text-slate-950">Dashboard</h1>
        <p className="mt-1 text-[12px] text-slate-500">
          Visualisez les franchisés déjà ouverts sur la carte.
        </p>
      </Card>
      <FranceMap points={points} />
    </div>
  );
}
