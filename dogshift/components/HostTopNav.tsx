"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";

type HostTopNavProps = {
  className?: string;
};

export default function HostTopNav({ className }: HostTopNavProps) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const sessionSitterId = null;
  const [dbSitterId, setDbSitterId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setDbSitterId(null);
      return;
    }

    void (async () => {
      try {
        const res = await fetch("/api/host/profile", { method: "GET" });
        const payload = (await res.json()) as { ok?: boolean; sitterId?: string | null };
        if (!res.ok || !payload.ok) return;
        if (typeof payload.sitterId === "string" && payload.sitterId.trim()) {
          setDbSitterId(payload.sitterId.trim());
        }
      } catch {
        // ignore
      }
    })();
  }, [isLoaded, isSignedIn]);

  const sitterId = dbSitterId ?? sessionSitterId;

  const publicHref = useMemo(() => {
    if (!isLoaded || !isSignedIn) return "/login";
    return sitterId ? `/sitter/${sitterId}?mode=preview` : "/host/profile/edit";
  }, [sitterId, isLoaded, isSignedIn]);

  const activeTab = useMemo(() => {
    if (pathname === "/host") return "dashboard";
    if (pathname?.startsWith("/host/profile")) return "host";
    if (pathname?.startsWith("/host/messages")) return "messages";
    if (pathname?.startsWith("/sitter/")) return "public";
    return "dashboard";
  }, [pathname]);

  const baseBtn =
    "inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] border w-[200px] flex-none";

  const activeBtn =
    baseBtn +
    " border-[var(--dogshift-blue)] bg-[var(--dogshift-blue)] text-white shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] hover:bg-[var(--dogshift-blue-hover)]";

  const inactiveBtn =
    baseBtn + " border-slate-300 bg-white text-slate-900 hover:bg-slate-50";

  return (
    <nav
      aria-label="Navigation Host"
      className={
        "flex flex-col gap-2 overflow-x-auto sm:flex-row sm:items-center sm:justify-center sm:gap-3 sm:overflow-visible" +
        (className ? ` ${className}` : "")
      }
    >
      <Link href="/host" className={activeTab === "dashboard" ? activeBtn : inactiveBtn}>
        Tableau de bord
      </Link>
      <Link href={publicHref} className={activeTab === "public" ? activeBtn : inactiveBtn}>
        Profil public
      </Link>
      <Link href="/host/messages" className={activeTab === "messages" ? activeBtn : inactiveBtn}>
        Messages
      </Link>
      <Link href="/host/profile/edit" className={activeTab === "host" ? activeBtn : inactiveBtn}>
        Modifier le profil
      </Link>
    </nav>
  );
}
