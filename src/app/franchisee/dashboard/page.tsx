import { RevenueChart } from "@/components/charts/revenue-chart";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

export default async function FranchiseeDashboardPage() {
  const session = await requireRole(["FRANCHISEE"]);
  const franchisee = await prisma.franchisee.findFirstOrThrow({
    where: { userId: session.user.id },
    include: { kpis: { orderBy: { month: "asc" } } }
  });

  const allKpis = await prisma.kpiMonthly.findMany();
  const average =
    allKpis.length > 0 ? allKpis.reduce((sum, item) => sum + item.revenue, 0) / allKpis.length : 0;

  const chartData = franchisee.kpis.map((kpi) => ({
    month: new Date(kpi.month).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
    revenue: kpi.revenue,
    average
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">CA du mois</p>
          <p className="mt-2 text-3xl font-bold">
            {chartData.at(-1)?.revenue?.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) ?? "0 €"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Moyenne réseau</p>
          <p className="mt-2 text-3xl font-bold">
            {average.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Points KPI</p>
          <p className="mt-2 text-3xl font-bold">{chartData.length}</p>
        </Card>
      </div>
      <Card>
        <h2 className="text-2xl font-bold">Évolution du chiffre d'affaires</h2>
        <RevenueChart data={chartData} />
      </Card>
    </div>
  );
}
