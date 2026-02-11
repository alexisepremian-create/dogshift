"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

import Sidebar from "@/components/Sidebar";
import { useOwnerDashboardNavItems } from "@/components/dashboardNavItems";

type OwnerSidebarProps = {
  onNavigate?: () => void;
  className?: string;
  forceExpanded?: boolean;
};

export default function OwnerSidebar({ onNavigate, className, forceExpanded }: OwnerSidebarProps) {
  const clerk = useClerk();
  const { items } = useOwnerDashboardNavItems();

  const footer = (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.removeItem("ds_auth_user");
          } catch {
            // ignore
          }
          void clerk.signOut({ redirectUrl: "/login?force=1" });
        }}
        className={
          "group/item relative flex items-center rounded-2xl text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] " +
          (forceExpanded ? "w-full gap-3 px-3 py-2" : "h-10 w-10 justify-center")
        }
        title={!forceExpanded ? "Déconnexion" : undefined}
      >
        <LogOut className="h-4 w-4 shrink-0 text-slate-500 transition group-hover/item:text-slate-700" aria-hidden="true" />
        {forceExpanded ? <span className="whitespace-nowrap">Déconnexion</span> : null}
      </button>

      {!forceExpanded ? (
        <div
          className={
            "pointer-events-none absolute left-full top-1/2 z-50 ml-3 w-max -translate-y-1/2 translate-x-2 opacity-0 " +
            "transition-all duration-[180ms] ease-out " +
            "group-hover/item:translate-x-0 group-hover/item:opacity-100 " +
            "group-focus-within/item:translate-x-0 group-focus-within/item:opacity-100"
          }
          aria-hidden="true"
        >
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.25)]">
            <p className="text-sm font-semibold text-slate-900">Déconnexion</p>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <Sidebar
      ariaLabel="Navigation Owner"
      items={items.map((item) => ({ ...item, prefetch: false }))}
      footer={footer}
      onNavigate={onNavigate}
      className={className}
      forceExpanded={forceExpanded}
    />
  );
}
