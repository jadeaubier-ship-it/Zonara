import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { StepsTimeline } from "@/components/candidate/steps-timeline";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

const FranceMap = dynamic(() => import("@/components/maps/france-map").then((mod) => mod.FranceMap), {
  ssr: false
});

export default async function CandidateDashboardPage() {
  const session = await requireRole(["CANDIDATE"]);
  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { userId: session.user.id },
    include: { steps: { orderBy: { stepNumber: "asc" } }, user: true }
  });
  const franchisees = await prisma.franchisee.findMany();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Étape actuelle</p>
          <p className="mt-2 text-3xl font-bold">{candidate.currentStep}/10</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Score</p>
          <p className="mt-2 text-3xl font-bold">{candidate.scoreHeat}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Brochure</p>
          <a className="mt-2 inline-block font-semibold" href="/brochure-atome3d.pdf">
            Télécharger la brochure
          </a>
        </Card>
      </div>
      <StepsTimeline steps={candidate.steps} />
      <FranceMap
        points={[
          ...franchisees
            .filter((item) => item.latitude && item.longitude)
            .map((item) => ({
              id: item.id,
              label: item.city,
              latitude: item.latitude!,
              longitude: item.longitude!,
              type: "Franchisé"
            })),
          {
            id: candidate.id,
            label: candidate.city,
            latitude: 48.8566,
            longitude: 2.3522,
            type: "Votre ville"
          }
        ]}
      />
    </div>
  );
}
