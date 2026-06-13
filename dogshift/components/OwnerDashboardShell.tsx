"use client";

import { LogOut } from "lucide-react";

import BrandLogo from "@/components/BrandLogo";
import MobileBottomNav from "@/components/MobileBottomNav";
import OwnerSidebar from "@/components/OwnerSidebar";
import { useOwnerDashboardNavItems } from "@/components/dashboardNavItems";
import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

/** Primary tabs in the bottom bar (max 4 + « Plus »), owner-specific labels */
const PRIMARY_NAV_KEYS = ["dashboard", "bookings", "messages", "dogs"] as const;

const MORE_NAV_KEYS = ["wallet", "settings"] as const;

const BOTTOM_NAV_LABELS: Record<string, string> = {
  dashboard: "Accueil",
  bookings: "Réservations",
  messages: "Messages",
  dogs: "Chiens",
  wallet: "Portefeuille",
  settings: "Paramètres",
};

export default function OwnerDashboardShell({ children }: { children: React.ReactNode }) {

  const { items } = useOwnerDashboardNavItems();
  // In the Capacitor shell we let <GlobalNativeBottomNav> (rendered from
  // app/layout.tsx) handle the bottom nav — it stays mounted across all
  // section transitions, so the user never sees the bar disappear /
  // reappear. Web keeps the per-section nav for richer dashboard tabs.
  const isNative = useIsNativeApp();

  const toNavItem = (key: string) => {
    const found = items.find((i) => i.key === key);
    return found ? { ...found, label: BOTTOM_NAV_LABELS[found.key] ?? found.label } : null;
  };

  const primaryNavItems = (PRIMARY_NAV_KEYS as readonly string[])
    .map(toNavItem)
    .filter(Boolean) as import("@/components/MobileBottomNav").BottomNavItem[];

  const moreFromKeys = (MORE_NAV_KEYS as readonly string[])
    .map(toNavItem)
    .filter(Boolean) as import("@/components/MobileBottomNav").BottomNavItem[];

  const signOutItem: import("@/components/MobileBottomNav").BottomNavItem = {
    key: "signout",
    label: "Déconnexion",
    href: "/sign-out?redirect=%2Flogin",
    icon: <LogOut className="h-5 w-5" aria-hidden="true" />,
    active: false,
  };

  const moreNavItems = [...moreFromKeys, signOutItem];

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white text-slate-900">
      <div className="flex min-h-screen">
        <div className="relative z-40 hidden shrink-0 lg:block">
          <OwnerSidebar className="sticky top-0 h-screen" forceExpanded />
        </div>

        <div className="relative z-0 flex min-w-0 flex-1 flex-col">
          {/* Logo header hidden in the native app (looks like a website). Web
              keeps it. See HostDashboardShell for the rationale. */}
          {!isNative && (
            <header
              className="fixed inset-x-0 z-[70] flex h-14 items-center border-b border-slate-100 bg-white/95 px-5 backdrop-blur-md lg:hidden"
              style={{
                top: "var(--ds-maintenance-banner-height, 0px)",
                paddingTop: "env(safe-area-inset-top, 0px)",
                height: "calc(3.5rem + env(safe-area-inset-top, 0px))",
              }}
            >
              <BrandLogo href="/" priority />
            </header>
          )}

          <main
            className={
              isNative
                ? "flex-1 px-3 pt-[calc(env(safe-area-inset-top,0px)+var(--ds-maintenance-banner-height,0px)+8px)]"
                : "flex-1 px-4 sm:px-6 lg:px-10 " +
                  "pt-[calc(3.5rem+env(safe-area-inset-top,0px)+var(--ds-maintenance-banner-height,0px))] " +
                  "lg:pt-[calc(1.125rem+var(--ds-maintenance-banner-height,0px))]"
            }
          >
            <div className={isNative ? "w-full py-3" : "mx-auto w-full max-w-6xl py-4 lg:py-5"}>{children}</div>

            <div
              className="block lg:hidden"
              style={{ height: "calc(72px + env(safe-area-inset-bottom))" }}
              aria-hidden="true"
            />
          </main>
        </div>
      </div>

      {!isNative && (
        <MobileBottomNav items={primaryNavItems} moreItems={moreNavItems} />
      )}
    </div>
  );
}
