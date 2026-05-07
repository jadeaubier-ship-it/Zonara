"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { LogoutButton } from "@/components/layout/logout-button";

export function Sidebar({
  title,
  items,
  footerItems,
  userName
}: {
  title: string;
  items: Array<{ href: string; label: string }>;
  footerItems?: Array<{ href: string; label: string }>;
  userName?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-6 flex h-[calc(100vh-3rem)] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div>
        <div className="mb-5 flex justify-center">
          <Image src="/atome3d-logo.svg" alt="Atome3D" width={180} height={26} className="h-auto w-[180px]" priority />
        </div>
        <nav className="space-y-2">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-2xl px-4 py-3 text-sm font-medium",
                  active ? "bg-[#007cbd] text-white" : "text-slate-700 hover:bg-slate-100"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto space-y-3 border-t border-slate-100 pt-5">
        {footerItems?.length ? (
          <nav className="space-y-2">
            {footerItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-2xl px-4 py-3 text-sm font-medium",
                    active ? "bg-[#007cbd] text-white" : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
        {userName ? <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{userName}</div> : null}
        <LogoutButton />
      </div>
    </aside>
  );
}
