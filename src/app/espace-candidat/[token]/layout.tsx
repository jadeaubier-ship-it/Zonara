import Link from "next/link";
import { getCandidatePortalLayoutContext } from "@/lib/services/candidate-portal";

export default async function CandidatePortalLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { token: string };
}) {
  const { settings } = await getCandidatePortalLayoutContext();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-6">
      <div className="mb-8 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {settings.brandLogoDataUrl ? (
            <img
              src={settings.brandLogoDataUrl}
              alt={settings.brandName || "Enseigne"}
              className="h-auto max-h-10 w-auto max-w-[150px] object-contain"
            />
          ) : (
            <img src="/atome3d-logo.svg" alt={settings.brandName || "Atome3D"} className="h-auto w-[150px]" />
          )}
        </div>

        <nav className="flex items-center gap-2 text-[12px]">
          <Link
            href={`/espace-candidat/${params.token}/parametres`}
            className="rounded-2xl px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
          >
            Paramètres
          </Link>
          <Link
            href="/login"
            className="rounded-2xl px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
          >
            Se déconnecter
          </Link>
        </nav>
      </div>

      <div className="space-y-6">{children}</div>
    </main>
  );
}
