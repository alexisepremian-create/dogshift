"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { LayoutDashboard, MessageSquare, Pencil, User, CalendarDays, Settings, Wallet, SlidersHorizontal } from "lucide-react";

import { useHostUser } from "@/components/HostUserProvider";

type NavItemBase = {
  key: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
};

export type DashboardNavItem = NavItemBase & {
  prefetch?: boolean;
  onMouseEnter?: () => void;
  onFocus?: () => void;
};

export function useHostDashboardNavItems() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { sitterId } = useHostUser();

  const disablePrefetch = useMemo(() => (searchParams?.get("mode") ?? "") === "preview", [searchParams]);

  const publicHref = useMemo(() => {
    if (!isLoaded || !isSignedIn) return "/login";
    return sitterId ? `/sitter/${encodeURIComponent(sitterId)}?mode=preview` : "/host/profile/edit";
  }, [sitterId, isLoaded, isSignedIn]);

  const activeKey = useMemo(() => {
    if (pathname === "/host") return "dashboard";
    if (pathname?.startsWith("/dashboard/availability")) return "availability";
    if (pathname?.startsWith("/host/messages")) return "messages";
    if (pathname?.startsWith("/host/requests")) return "requests";
    if (pathname?.startsWith("/host/profile")) return "profile";
    if (pathname?.startsWith("/host/wallet")) return "wallet";
    if (pathname?.startsWith("/host/settings")) return "settings";
    const mode = searchParams?.get("mode") ?? "";
    if (pathname?.startsWith("/sitter/") && mode === "preview") return "public";
    return "dashboard";
  }, [pathname, searchParams]);

  const items = useMemo<DashboardNavItem[]>(() => {
    const raw: NavItemBase[] = [
      {
        key: "dashboard",
        label: "Tableau de bord",
        description: "Vue d’ensemble de ton activité.",
        href: "/host",
        icon: <LayoutDashboard className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "dashboard",
      },
      {
        key: "availability",
        label: "Disponibilités",
        description: "Configurer ton agenda et tes règles.",
        href: "/dashboard/availability",
        icon: <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "availability",
      },
      {
        key: "public",
        label: "Profil public",
        description: "Aperçu de ta page sitter.",
        href: publicHref,
        icon: <User className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "public",
      },
      {
        key: "messages",
        label: "Messages",
        description: "Conversations avec les clients.",
        href: "/host/messages",
        icon: <MessageSquare className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "messages",
      },
      {
        key: "requests",
        label: "Demandes",
        description: "Réservations et demandes.",
        href: "/host/requests",
        icon: <CalendarDays className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "requests",
      },
      {
        key: "wallet",
        label: "Portefeuille",
        description: "Paiements et revenus.",
        href: "/host/wallet",
        icon: <Wallet className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "wallet",
      },
      {
        key: "profile",
        label: "Profil",
        description: "Modifier tes infos.",
        href: "/host/profile/edit",
        icon: <Pencil className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "profile",
      },
      {
        key: "settings",
        label: "Paramètres",
        description: "Compte et préférences.",
        href: "/host/settings",
        icon: <Settings className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "settings",
      },
    ];

    return raw.map((item) => {
      const shouldPrefetch = item.key === "public" ? !disablePrefetch : true;
      return {
        ...item,
        prefetch: shouldPrefetch,
        onMouseEnter: () => {
          if (disablePrefetch) return;
          if (item.key !== "public") return;
          if (!item.href.startsWith("/sitter/")) return;
          void router.prefetch(item.href);
        },
        onFocus: () => {
          if (disablePrefetch) return;
          if (item.key !== "public") return;
          if (!item.href.startsWith("/sitter/")) return;
          void router.prefetch(item.href);
        },
      };
    });
  }, [activeKey, publicHref, disablePrefetch, router]);

  return { items, isLoaded };
}

export function useOwnerDashboardNavItems() {
  const pathname = usePathname();

  const activeKey = useMemo(() => {
    if (pathname === "/account") return "dashboard";
    if (pathname?.startsWith("/account/bookings")) return "bookings";
    if (pathname?.startsWith("/account/messages")) return "messages";
    if (pathname?.startsWith("/account/wallet")) return "wallet";
    if (pathname?.startsWith("/account/settings")) return "settings";
    return "dashboard";
  }, [pathname]);

  const items = useMemo<DashboardNavItem[]>(() => {
    return [
      {
        key: "dashboard",
        label: "Tableau de bord",
        description: "Réservations, messages et activités.",
        href: "/account",
        icon: <LayoutDashboard className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "dashboard",
        prefetch: false,
      },
      {
        key: "bookings",
        label: "Réservations",
        description: "Historique et statut des gardes.",
        href: "/account/bookings",
        icon: <CalendarDays className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "bookings",
        prefetch: false,
      },
      {
        key: "messages",
        label: "Messages",
        description: "Conversations avec les sitters.",
        href: "/account/messages",
        icon: <MessageSquare className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "messages",
        prefetch: false,
      },
      {
        key: "wallet",
        label: "Portefeuille",
        description: "Paiements et factures.",
        href: "/account/wallet",
        icon: <Wallet className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "wallet",
        prefetch: false,
      },
      {
        key: "settings",
        label: "Paramètres",
        description: "Compte et sécurité.",
        href: "/account/settings",
        icon: <Settings className="h-5 w-5" aria-hidden="true" />,
        active: activeKey === "settings",
        prefetch: false,
      },
    ];
  }, [activeKey]);

  return { items };
}
