"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type OwnerTopNavProps = {
  className?: string;
};

export default function OwnerTopNav({ className }: OwnerTopNavProps) {
  const pathname = usePathname();

  const activeTab = useMemo(() => {
    if (pathname === "/account") return "bookings";
    if (pathname?.startsWith("/account/bookings")) return "bookings";
    if (pathname?.startsWith("/account/messages")) return "messages";
    if (pathname?.startsWith("/account/settings")) return "settings";
    return "bookings";
  }, [pathname]);

  const baseBtn =
    "inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] border w-[200px] flex-none";

  const activeBtn =
    baseBtn +
    " border-[var(--dogshift-blue)] bg-[var(--dogshift-blue)] text-white shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] hover:bg-[var(--dogshift-blue-hover)]";

  const inactiveBtn = baseBtn + " border-slate-300 bg-white text-slate-900 hover:bg-slate-50";

  return (
    <nav
      aria-label="Navigation Owner"
      className={
        "flex flex-col gap-2 overflow-x-auto sm:flex-row sm:items-center sm:justify-center sm:gap-3 sm:overflow-visible" +
        (className ? ` ${className}` : "")
      }
    >
      <Link href="/account/bookings" prefetch={false} className={activeTab === "bookings" ? activeBtn : inactiveBtn}>
        Réservations
      </Link>
      <Link href="/account/messages" prefetch={false} className={activeTab === "messages" ? activeBtn : inactiveBtn}>
        Messages
      </Link>
      <Link href="/account/settings" prefetch={false} className={activeTab === "settings" ? activeBtn : inactiveBtn}>
        Paramètres
      </Link>
    </nav>
  );
}
