import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("rounded-3xl border border-slate-200 bg-white p-6 shadow-soft", className)}>{children}</div>;
}
