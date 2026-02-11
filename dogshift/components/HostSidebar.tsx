"use client";

import { useMemo } from "react";
import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

import Sidebar from "@/components/Sidebar";
import { useHostDashboardNavItems } from "@/components/dashboardNavItems";

type HostSidebarProps = {
  onNavigate?: () => void;
  className?: string;
  forceExpanded?: boolean;
};

export default function HostSidebar({ onNavigate, className, forceExpanded }: HostSidebarProps) {
  const clerk = useClerk();
  const { items: mappedItems, isLoaded } = useHostDashboardNavItems();

  if (!isLoaded) {
    return (
      <aside
        className={
          "flex h-full flex-col border-r border-slate-200 bg-white" + (className ? ` ${className}` : "")
        }
        aria-busy="true"
        aria-live="polite"
      >
        <div className="px-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-100" />
            <div className="flex-1">
              <div className="h-4 w-28 rounded bg-slate-100" />
              <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-2xl px-3 py-3">
                <div className="h-4 w-4 rounded bg-slate-100" />
                <div className="h-4 w-32 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

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
      ariaLabel="Navigation Host"
      items={mappedItems}
      footer={footer}
      onNavigate={onNavigate}
      className={className}
      forceExpanded={forceExpanded}
    />
  );
}
