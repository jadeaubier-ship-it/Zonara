import { DashboardHeader } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { requireRole } from "@/lib/auth/session";

const items = [
  { href: "/franchisee/dashboard", label: "KPI mensuels" },
  { href: "/franchisee/documents", label: "Documents réseau" }
];

export default async function FranchiseeLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["FRANCHISEE"]);

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[260px_1fr]">
      <Sidebar title="Espace franchisé" items={items} />
      <div className="space-y-6">
        <DashboardHeader
          title="Votre activité réseau"
          subtitle="Suivez vos KPI, vos revenus et les documents du réseau Atome3D."
          userName={`${session.user.firstname} ${session.user.lastname}`}
        />
        {children}
      </div>
    </main>
  );
}
