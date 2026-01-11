"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useMemo } from "react";
import { LayoutDashboard, CalendarDays, MessageSquare, Settings, LogOut, Wallet } from "lucide-react";

type OwnerSidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
};

export default function OwnerSidebar({ onNavigate, className }: OwnerSidebarProps) {
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

  const linkBase =
    "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";
  const activeLink = linkBase + " bg-slate-50 text-slate-900";
  const inactiveLink = linkBase + " text-slate-600 hover:bg-slate-50 hover:text-slate-900";

  return (
    <aside
      className={
        "flex h-full w-full flex-col border-r border-slate-200 bg-white" + (className ? ` ${className}` : "")
      }
    >
      <div className="px-4 pt-2.5">
        <Link
          href="/"
          aria-label="DogShift"
          className="inline-flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50"
          onClick={onNavigate}
        >
          <Image
            src="/dogshift-logo.png"
            alt="DogShift"
            width={320}
            height={96}
            className="h-16 w-auto max-w-[220px]"
            priority
          />
        </Link>
      </div>

      <div className="px-4 pt-6">
        <nav aria-label="Navigation Owner" className="space-y-1">
          {items.map((item) => (
            <div key={item.key} className="relative">
              {item.active ? (
                <div className="pointer-events-none absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-[var(--dogshift-blue)]" />
              ) : null}
              <Link href={item.href} className={item.active ? activeLink : inactiveLink} onClick={onNavigate}>
                <span className={"text-slate-500 group-hover:text-slate-700" + (item.active ? " text-slate-700" : "")}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </div>
          ))}
        </nav>

        <div className="mt-6 border-t border-slate-200" />

        <div className="pt-4">
          <button
            type="button"
            onClick={() => {
              void clerk.signOut({ redirectUrl: "/login" });
            }}
            className={
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            }
          >
            <LogOut className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
