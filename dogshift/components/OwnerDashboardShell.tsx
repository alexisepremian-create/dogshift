"use client";

import { LogOut } from "lucide-react";
import { useClerk } from "@clerk/nextjs";

import BrandLogo from "@/components/BrandLogo";
import MobileBottomNav from "@/components/MobileBottomNav";
import OwnerSidebar from "@/components/OwnerSidebar";
import { useOwnerDashboardNavItems } from "@/components/dashboardNavItems";

/** Primary tabs in the bottom bar (max 4 + « Plus »), owner-specific labels */
const PRIMARY_NAV_KEYS = ["dashboard", "bookings", "messages", "settings"] as const;

const MORE_NAV_KEYS = ["wallet"] as const;

const BOTTOM_NAV_LABELS: Record<string, string> = {
  dashboard: "Accueil",
  bookings: "Réservations",
  messages: "Messages",
  settings: "Paramètres",
  wallet: "Portefeuille",
};

export default function OwnerDashboardShell({ children }: { children: React.ReactNode }) {
  useClerk();
  const { items } = useOwnerDashboardNavItems();

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
    href: "/sign-out?redirect=%2Flogin%3Fforce%3D1",
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
          <header
            className="fixed inset-x-0 z-[70] flex h-14 items-center border-b border-slate-100 bg-white/95 px-5 backdrop-blur-md lg:hidden"
            style={{ top: "var(--ds-maintenance-banner-height, 0px)" }}
          >
            <BrandLogo href="/" priority />
          </header>

          <main
            className="flex-1 px-4 sm:px-6 lg:px-10 lg:pt-8"
            style={{ paddingTop: "calc(3.5rem + var(--ds-maintenance-banner-height, 0px))" }}
          >
            <div className="mx-auto w-full max-w-6xl py-6 lg:py-8">{children}</div>

            <div
              className="block lg:hidden"
              style={{ height: "calc(72px + env(safe-area-inset-bottom))" }}
              aria-hidden="true"
            />
          </main>
        </div>
      </div>

      <MobileBottomNav items={primaryNavItems} moreItems={moreNavItems} />
    </div>
  );
}
