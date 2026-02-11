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
        href: "/account",
        icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "dashboard",
      },
      {
        key: "bookings",
        label: "Réservations",
        href: "/account/bookings",
        icon: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "bookings",
      },
      {
        key: "messages",
        label: "Messages",
        href: "/account/messages",
        icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "messages",
      },
      {
        key: "wallet",
        label: "Portefeuille",
        href: "/account/wallet",
        icon: <Wallet className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "wallet",
      },
      {
        key: "settings",
        label: "Paramètres",
        href: "/account/settings",
        icon: <Settings className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "settings",
      },
    ];
  }, [activeKey]);

  const footer = (
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
        "group/item flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
      }
      title={!forceExpanded ? "Déconnexion" : undefined}
    >
      <LogOut className="h-4 w-4 shrink-0 text-slate-500 transition group-hover/item:text-slate-700" aria-hidden="true" />
      <span
        className={
          "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-[250ms] ease-in-out " +
          (forceExpanded ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100")
        }
      >
        Déconnexion
      </span>
    </button>
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
