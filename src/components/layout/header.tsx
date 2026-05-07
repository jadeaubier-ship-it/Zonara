import { LogoutButton } from "@/components/layout/logout-button";

export function DashboardHeader({
  title,
  subtitle,
  userName
}: {
  title: string;
  subtitle: string;
  userName: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-700">Atome3D</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{userName}</div>
        <LogoutButton />
      </div>
    </div>
  );
}
