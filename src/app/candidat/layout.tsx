import { DashboardHeader } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { requireRole } from "@/lib/auth/session";

const items = [
  { href: "/candidat/dashboard", label: "Mon parcours" },
  { href: "/candidat/etape/1", label: "Mes étapes" }
];

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["CANDIDATE"]);

  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[260px_1fr]">
      <Sidebar title="Espace candidat" items={items} />
      <div className="space-y-6">
        <DashboardHeader
          title="Votre parcours de franchise"
          subtitle="Suivez vos étapes, vos signatures, vos rendez-vous et vos documents."
          userName={`${session.user.firstname} ${session.user.lastname}`}
        />
        {children}
      </div>
    </main>
  );
}
