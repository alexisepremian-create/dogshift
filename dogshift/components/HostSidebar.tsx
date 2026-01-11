"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { LayoutDashboard, MessageSquare, Pencil, User, LogOut, CalendarDays, Settings, Wallet } from "lucide-react";

type HostSidebarProps = {
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

export default function HostSidebar({ onNavigate, className }: HostSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useUser();
  const sessionSitterId = null;
  const [dbSitterId, setDbSitterId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setDbSitterId(null);
      return;
    }

    void (async () => {
      try {
        const res = await fetch("/api/host/profile", { method: "GET", cache: "no-store" });
        const payload = (await res.json()) as { ok?: boolean; sitterId?: string | null };
        if (!res.ok || !payload.ok) return;
        if (typeof payload.sitterId === "string" && payload.sitterId.trim()) {
          setDbSitterId(payload.sitterId.trim());
        }
      } catch {
        // ignore
      }
    })();
  }, [isLoaded, isSignedIn]);

  const sitterId = dbSitterId ?? sessionSitterId;

  const publicHref = useMemo(() => {
    if (!isLoaded || !isSignedIn) return "/login";
    return sitterId ? `/sitter/${encodeURIComponent(sitterId)}?mode=preview` : "/host/profile/edit";
  }, [sitterId, isLoaded, isSignedIn]);

  const activeKey = useMemo(() => {
    if (pathname === "/host") return "dashboard";
    if (pathname?.startsWith("/host/messages")) return "messages";
    if (pathname?.startsWith("/host/requests")) return "requests";
    if (pathname?.startsWith("/host/profile")) return "profile";
    if (pathname?.startsWith("/host/wallet")) return "wallet";
    if (pathname?.startsWith("/host/settings")) return "settings";
    const mode = searchParams?.get("mode") ?? "";
    if (pathname?.startsWith("/sitter/") && mode === "preview") return "public";
    return "dashboard";
  }, [pathname, searchParams]);

  const items = useMemo<NavItem[]>(() => {
    return [
      {
        key: "dashboard",
        label: "Tableau de bord",
        href: "/host",
        icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "dashboard",
      },
      {
        key: "public",
        label: "Profil public",
        href: publicHref,
        icon: <User className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "public",
      },
      {
        key: "messages",
        label: "Messages",
        href: "/host/messages",
        icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "messages",
      },
      {
        key: "requests",
        label: "Demandes & réservations",
        href: "/host/requests",
        icon: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "requests",
      },
      {
        key: "wallet",
        label: "Portefeuille",
        href: "/host/wallet",
        icon: <Wallet className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "wallet",
      },
      {
        key: "profile",
        label: "Modifier le profil",
        href: "/host/profile/edit",
        icon: <Pencil className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "profile",
      },
      {
        key: "settings",
        label: "Paramètres",
        href: "/host/settings",
        icon: <Settings className="h-4 w-4" aria-hidden="true" />,
        active: activeKey === "settings",
      },
    ];
  }, [activeKey, publicHref]);

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
        <nav aria-label="Navigation Host" className="space-y-1">
          {items.map((item) => (
            <div key={item.key} className="relative">
              {item.active ? (
                <div className="pointer-events-none absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-[var(--dogshift-blue)]" />
              ) : null}
              <Link
                href={item.href}
                className={item.active ? activeLink : inactiveLink}
                onClick={onNavigate}
              >
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
