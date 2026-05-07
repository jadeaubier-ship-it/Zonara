import { FranchiseeSummaryCard } from "@/components/admin/franchisee-summary-card";
import { prisma } from "@/lib/db/prisma";

export default async function FranchiseesPage() {
  const franchisees = await prisma.franchisee.findMany({
    include: { user: true, kpis: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-4">
      {franchisees.map((franchisee) => (
        <FranchiseeSummaryCard key={franchisee.id} franchisee={franchisee} />
      ))}
    </div>
  );
}
