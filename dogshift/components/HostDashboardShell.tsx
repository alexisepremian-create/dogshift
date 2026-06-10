"use client";

import { usePathname, useSearchParams } from "next/navigation";

import HostComplianceBlockingModal from "@/components/HostComplianceBlockingModal";
import MobileBottomNav from "@/components/MobileBottomNav";
import HostSidebar from "@/components/HostSidebar";
import BrandLogo from "@/components/BrandLogo";
import { useHostUser } from "@/components/HostUserProvider";
import { useHostDashboardNavItems } from "@/components/dashboardNavItems";
import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

/** Primary tabs shown directly in the bottom bar (max 4 + "More") */
const PRIMARY_NAV_KEYS = ["dashboard", "requests", "messages", "availability"] as const;

/** Overflow items accessible via the "More" (⋯) tab */
const MORE_NAV_KEYS = ["public", "wallet", "profile", "settings"] as const;

/** Shorter labels that fit comfortably inside the tab pill */
const BOTTOM_NAV_LABELS: Record<string, string> = {
  dashboard: "Accueil",
  requests: "Réservations",
  messages: "Messages",
  availability: "Agenda",
  public: "Profil public",
  wallet: "Portefeuille",
  profile: "Mon profil",
  settings: "Paramètres",
};

export default function HostDashboardShell({ children }: { children: React.ReactNode }) {
  const host = useHostUser();

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { items } = useHostDashboardNavItems();
  // Capacitor shell uses <GlobalNativeBottomNav> from app/layout.tsx so the
  // bottom bar persists across all section navigations.
  const isNative = useIsNativeApp();

  const mode = (searchParams?.get("mode") ?? "").trim();
  const isPublicPreview = pathname?.startsWith("/sitter/") && mode === "preview";

  const toNavItem = (key: string) => {
    const found = items.find((i) => i.key === key);
    return found ? { ...found, label: BOTTOM_NAV_LABELS[found.key] ?? found.label } : null;
  };

  const primaryNavItems = (PRIMARY_NAV_KEYS as readonly string[]).map(toNavItem).filter(Boolean) as import("@/components/MobileBottomNav").BottomNavItem[];
  const moreNavItems = (MORE_NAV_KEYS as readonly string[]).map(toNavItem).filter(Boolean) as import("@/components/MobileBottomNav").BottomNavItem[];

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white text-slate-900">
      {/*
       * Sitter compliance gate — blocking modal that surfaces when the sitter
       * has either (1) not accepted the current CGU version, or (2) has not
       * accepted the active contract amendment. Calls `/api/host/accept-terms`,
       * `/api/host/accept-compliance`, or `/api/host/contract-amendment/accept`
       * depending on what's missing.
       *
       * MUST stay rendered here. The server-side gate in `lib/sitterGuards.ts`
       * blocks publish + sensitive actions with HTTP 403 + `TERMS_NOT_ACCEPTED`
       * when terms are stale, and without this modal the sitter sees the
       * warning ("Accepter le règlement DogShift") but has no way to fulfill
       * it — Sonia's recurring bug. Commit fef3977f7 (2026-03-24) removed it
       * mistakenly during a "separate sitter compliance from owner terms"
       * refactor; rewired by this fix. See docs/bugs/sitter-terms-modal-missing.md.
       *
       * This modal is a superset of HostContractAmendmentModal — it covers
       * both terms and amendment in one UI, so we deliberately don't render
       * the older single-purpose modal here anymore.
       */}
      {isPublicPreview || !host.sitterId ? null : <HostComplianceBlockingModal host={host} />}

      <div className="flex min-h-screen">
        {/* ── Desktop sidebar — always expanded ── */}
        <div className="relative z-40 hidden shrink-0 lg:block">
          <HostSidebar className="sticky top-0 h-screen" forceExpanded />
        </div>

        {/* ── Main content area ── */}
        <div className="relative z-0 flex min-w-0 flex-1 flex-col">

          {/* Mobile top header — logo only (no hamburger, nav is in the bottom bar) */}
          <header
            className="fixed inset-x-0 z-[70] flex h-14 items-center border-b border-slate-100 bg-white/95 px-5 backdrop-blur-md lg:hidden"
            style={{
              top: "var(--ds-maintenance-banner-height, 0px)",
              // contentInset: "never" → the WebView extends under the status
              // bar, so push the bar down by the safe-area inset (0 on web).
              paddingTop: "env(safe-area-inset-top, 0px)",
              height: "calc(3.5rem + env(safe-area-inset-top, 0px))",
            }}
          >
            <BrandLogo href="/" priority />
          </header>

          <main
            className={
              "flex-1 px-4 sm:px-6 lg:px-10 " +
              "pt-[calc(3.5rem+env(safe-area-inset-top,0px)+var(--ds-maintenance-banner-height,0px))] " +
              "lg:pt-[calc(1.125rem+var(--ds-maintenance-banner-height,0px))]"
            }
          >
            <div className="mx-auto w-full max-w-6xl py-4 lg:py-5">
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

      {/* ── Mobile bottom navigation (web only — native uses the global nav) ── */}
      {!isNative && (
        <MobileBottomNav items={primaryNavItems} moreItems={moreNavItems} />
      )}
    </div>
  );
}
