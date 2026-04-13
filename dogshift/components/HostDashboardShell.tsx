"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";

import HostContractAmendmentModal from "@/components/HostContractAmendmentModal";
import MobileBottomNav from "@/components/MobileBottomNav";
import HostSidebar from "@/components/HostSidebar";
import BrandLogo from "@/components/BrandLogo";
import { useHostUser } from "@/components/HostUserProvider";
import { useHostDashboardNavItems } from "@/components/dashboardNavItems";

/** Keys shown in the mobile bottom nav, in display order */
const BOTTOM_NAV_KEYS = ["dashboard", "requests", "messages", "availability", "settings"] as const;

/** Shorter labels that fit comfortably inside the tab pill */
const BOTTOM_NAV_LABELS: Record<string, string> = {
  dashboard: "Accueil",
  requests: "Réservations",
  messages: "Messages",
  availability: "Agenda",
  settings: "Profil",
};

export default function HostDashboardShell({ children }: { children: React.ReactNode }) {
  const host = useHostUser();
  useClerk();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { items } = useHostDashboardNavItems();

  const mode = (searchParams?.get("mode") ?? "").trim();
  const isPublicPreview = pathname?.startsWith("/sitter/") && mode === "preview";

  /** Five tabs for the mobile bottom nav, in defined order with short labels */
  const bottomNavItems = (BOTTOM_NAV_KEYS as readonly string[])
    .map((key) => items.find((i) => i.key === key))
    .filter(Boolean)
    .map((item) => ({ ...item!, label: BOTTOM_NAV_LABELS[item!.key] ?? item!.label }));

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white text-slate-900">
      {isPublicPreview || !host.sitterId ? null : <HostContractAmendmentModal />}

      <div className="flex min-h-screen">
        {/* ── Desktop sidebar — always expanded ── */}
        <div className="relative z-40 hidden shrink-0 lg:block">
          <HostSidebar className="sticky top-0 h-screen" forceExpanded />
        </div>

        {/* ── Main content area ── */}
        <div className="relative z-0 flex min-w-0 flex-1 flex-col">

          {/* Mobile top header — logo only (no hamburger, nav is in the bottom bar) */}
          <header className="fixed inset-x-0 top-0 z-[70] flex h-14 items-center border-b border-slate-100 bg-white/95 px-5 backdrop-blur-md lg:hidden">
            <BrandLogo href="/" priority />
          </header>

          <main className="flex-1 px-4 pt-14 sm:px-6 lg:px-10 lg:pt-8">
            <div className="mx-auto w-full max-w-6xl py-6 lg:py-8">
              {children}
            </div>

            {/*
              Spacer that prevents page content from being hidden behind
              the mobile bottom nav (60px bar + 12px margin + safe area).
            */}
            <div
              className="block lg:hidden"
              style={{ height: "calc(72px + env(safe-area-inset-bottom))" }}
              aria-hidden="true"
            />
          </main>
        </div>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <MobileBottomNav items={bottomNavItems} />
    </div>
  );
}
