"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useClerk } from "@clerk/nextjs";

import DashboardMobileNav from "@/components/DashboardMobileNav";
import OwnerSidebar from "@/components/OwnerSidebar";
import NotificationBell from "@/components/NotificationBell";
import { useOwnerDashboardNavItems } from "@/components/dashboardNavItems";

export default function OwnerDashboardShell({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const { items } = useOwnerDashboardNavItems();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="flex min-h-screen">
        <div className="relative z-40 hidden shrink-0 lg:block">
          <OwnerSidebar className="sticky top-0 h-screen" />
        </div>

        <div className="relative z-0 flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 bg-white/80 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <Link href="/" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
                  DogShift
                </Link>
              </div>

              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-8">
            <div className="mx-auto w-full max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>

      <DashboardMobileNav
        primaryItems={items.filter((item) => ["dashboard", "messages", "settings"].includes(item.key))}
        moreItems={items.filter((item) => !["dashboard", "messages", "settings"].includes(item.key))}
        moreLabel="Plus"
        moreIcon={<MoreHorizontal className="h-5 w-5" aria-hidden="true" />}
        onSignOut={() => {
          try {
            window.localStorage.removeItem("ds_auth_user");
          } catch {
            // ignore
          }
          void clerk.signOut({ redirectUrl: "/login?force=1" });
        }}
        signOutLabel="Déconnexion"
      />
    </div>
  );
}
