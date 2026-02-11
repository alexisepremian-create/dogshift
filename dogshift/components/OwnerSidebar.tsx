"use client";

import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useMemo } from "react";
import { LayoutDashboard, CalendarDays, MessageSquare, Settings, LogOut, Wallet } from "lucide-react";

import Sidebar from "@/components/Sidebar";

type OwnerSidebarProps = {
  onNavigate?: () => void;
  className?: string;
  forceExpanded?: boolean;
};

type NavItem = {
  key: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
};

export default function OwnerSidebar({ onNavigate, className, forceExpanded }: OwnerSidebarProps) {
  const clerk = useClerk();
  const pathname = usePathname();

  const activeKey = useMemo(() => {
    if (pathname === "/account") return "dashboard";
    if (pathname?.startsWith("/account/bookings")) return "bookings";
    if (pathname?.startsWith("/account/messages")) return "messages";
    if (pathname?.startsWith("/account/wallet")) return "wallet";
    if (pathname?.startsWith("/account/settings")) return "settings";
    return "dashboard";
  }, [pathname]);

  const items = useMemo<NavItem[]>(() => {
    return [
      {
        key: "dashboard",
        label: "Tableau de bord",
        description: "Réservations, messages et activités.",
        href: "/account",
        icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "dashboard",
      },
      {
        key: "bookings",
        label: "Réservations",
        description: "Historique et statut des gardes.",
        href: "/account/bookings",
        icon: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "bookings",
      },
      {
        key: "messages",
        label: "Messages",
        description: "Conversations avec les sitters.",
        href: "/account/messages",
        icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "messages",
      },
      {
        key: "wallet",
        label: "Portefeuille",
        description: "Paiements et factures.",
        href: "/account/wallet",
        icon: <Wallet className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "wallet",
      },
      {
        key: "settings",
        label: "Paramètres",
        description: "Compte et sécurité.",
        href: "/account/settings",
        icon: <Settings className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "settings",
      },
    ];
  }, [activeKey]);

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
