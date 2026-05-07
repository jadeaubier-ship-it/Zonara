import { cn } from "@/lib/utils/cn";

const variants = {
  primary: "bg-[#007cbd] text-white hover:bg-[#006da6]",
  secondary: "bg-slate-900 text-white hover:bg-slate-800",
  ghost: "bg-white text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700"
} as const;

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
