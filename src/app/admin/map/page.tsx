import nextDynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const FranceMap = nextDynamic(() => import("@/components/maps/france-map").then((mod) => mod.FranceMap), {
  ssr: false
});

export default async function AdminMapPage() {
  const [franchisees, candidates] = await Promise.all([
    prisma.franchisee.findMany({ include: { user: true } }),
    prisma.candidate.findMany({ include: { user: true } })
  ]);

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
    ...candidates
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
    <div className="space-y-4">
      <Card>
        <h2 className="text-2xl font-bold">Carte interactive du réseau</h2>
        <p className="mt-2 text-sm text-slate-600">Visualisez les candidats et les points franchisés actifs sur la carte de France.</p>
      </Card>
      <FranceMap points={points} />
    </div>
  );
}
