"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useUser } from "@clerk/nextjs";

import { useHostUser } from "@/components/HostUserProvider";

type HostTopNavProps = {
  className?: string;
};

export default function HostTopNav({ className }: HostTopNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const { sitterId } = useHostUser();

  const disablePrefetch = useMemo(() => (searchParams?.get("mode") ?? "") === "preview", [searchParams]);

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

  if (!isLoaded) {
    return (
      <nav
        aria-label="Navigation Host"
        aria-busy="true"
        aria-live="polite"
        className={
          "flex flex-col gap-2 overflow-x-auto sm:flex-row sm:items-center sm:justify-center sm:gap-3 sm:overflow-visible" +
          (className ? ` ${className}` : "")
        }
      >
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className={baseBtn + " border-slate-200 bg-slate-50 text-transparent"}>
            .
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Navigation Host"
      className={
        "flex flex-col gap-2 overflow-x-auto sm:flex-row sm:items-center sm:justify-center sm:gap-3 sm:overflow-visible" +
        (className ? ` ${className}` : "")
      }
    >
      <Link href="/host" prefetch={!disablePrefetch} className={activeTab === "dashboard" ? activeBtn : inactiveBtn}>
        Tableau de bord
      </Link>
      <Link href={publicHref} prefetch={!disablePrefetch} className={activeTab === "public" ? activeBtn : inactiveBtn}>
        Profil public
      </Link>
      <Link href="/host/messages" prefetch={!disablePrefetch} className={activeTab === "messages" ? activeBtn : inactiveBtn}>
        Messages
      </Link>
      <Link href="/host/profile/edit" prefetch={!disablePrefetch} className={activeTab === "host" ? activeBtn : inactiveBtn}>
        Modifier le profil
      </Link>
    </nav>
  );
}
