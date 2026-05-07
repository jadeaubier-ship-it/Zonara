import { Sidebar } from "@/components/layout/sidebar";
import { requireRole } from "@/lib/auth/session";

const items = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/candidates", label: "Candidats" },
  { href: "/admin/franchisees", label: "Franchisés" }
];

const footerItems = [{ href: "/admin/settings", label: "Paramètres" }];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["ADMIN", "DEV"]);

  return (
    <main className="grid min-h-screen w-full gap-6 px-4 py-4 lg:grid-cols-[260px_1fr] xl:px-6">
      <Sidebar
        title="Back-office"
        items={items}
        footerItems={footerItems}
        userName={`${session.user.firstname} ${session.user.lastname}`}
      />
      <div className="pt-8">{children}</div>
    </main>
  );
}
