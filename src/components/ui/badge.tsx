import { cn } from "@/lib/utils/cn";

const variants = {
  slate: "bg-slate-100 text-slate-700",
  orange: "bg-brand-100 text-brand-800",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-rose-100 text-rose-700",
  blue: "bg-sky-100 text-sky-700"
} as const;

export function Badge({
  children,
  variant = "slate",
  className
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", variants[variant], className)}>
      {children}
    </span>
  );
}
