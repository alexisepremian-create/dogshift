"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  House,
  Search,
  Heart,
  Calendar,
  MessageCircle,
  Inbox,
  LogIn,
  Info,
  HelpCircle,
  ScrollText,
  Shield,
  Lock,
  Mail,
  LogOut,
} from "lucide-react";

import MobileBottomNav, { type BottomNavItem } from "@/components/MobileBottomNav";
import { useIsNativeApp } from "@/lib/native/useIsNativeApp";
import { fetchAccountContext } from "@/lib/accountContext";

/**
 * Bottom tab bar shown app-wide inside the Capacitor native shell. Replaces
 * the marketing top header (which is hidden in native via SiteHeader).
 *
 * Contextual to the current user :
 *  - Anonymous : Accueil / Favoris / Se connecter / Plus
 *  - Owner    : Accueil / Mes réservations / Messages / Plus
 *  - Sitter   : Accueil / Demandes / Messages / Plus
 *  - Admin    : same as their primary role + admin entries under "Plus"
 *
 * Skipped on routes that already have their own bottom nav (/host, /account)
 * to avoid stacking two bars.
 *
 * Renders nothing on plain web.
 */
export default function GlobalNativeBottomNav() {
  const isNative = useIsNativeApp();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isSitter, setIsSitter] = useState(false);

  // Resolve "is this user a sitter?" the same way SiteHeader does.
  useEffect(() => {
    if (status !== "authenticated") {
      setIsSitter(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ctx = await fetchAccountContext();
        if (cancelled) return;
        setIsSitter(Boolean(ctx?.hasSitterProfile));
      } catch {
        if (!cancelled) setIsSitter(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  if (!isNative) return null;

  // /admin tooling is desktop-first; keep the global nav off there.
  if (pathname.startsWith("/admin")) {
    return null;
  }
  // For /host and /account we DELIBERATELY render the global nav too — the
  // per-section MobileBottomNav inside OwnerDashboardShell / HostDashboardShell
  // is hidden in native mode (`hidden` class via isNative), so this one stays
  // mounted across page transitions and never disappears/reappears. Founder
  // feedback : "la nav barre doit rester immobile et affichée même lorsque
  // je navigue sur les différentes sections".

  // Skip only on the micro-redirect / verification screens — keeping the tab
  // bar on /login and /signup so a user opening the auth tab from the nav
  // doesn't suddenly lose all navigation. (Earlier UX feedback : "quand je vais
  // dans la section de connexion ya plus la nav barre en bas" — fixed here.)
  if (
    pathname === "/post-login" ||
    pathname === "/check-email" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email")
  ) {
    return null;
  }

  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  const isAuthed = status === "authenticated";

  // Shared "Plus" overflow items
  const moreCommon: BottomNavItem[] = [
    { key: "devenir-sitter", label: "Devenir dogsitter", href: "/devenir-dogsitter", icon: <HelpCircle className="h-5 w-5" />, active: pathname === "/devenir-dogsitter" },
    { key: "contact", label: "Contact", href: "/contact", icon: <Mail className="h-5 w-5" />, active: pathname === "/contact" },
    { key: "cgu", label: "Conditions d'utilisation", href: "/cgu", icon: <ScrollText className="h-5 w-5" />, active: pathname === "/cgu" },
    { key: "confidentialite", label: "Confidentialité", href: "/confidentialite", icon: <Lock className="h-5 w-5" />, active: pathname === "/confidentialite" },
    { key: "mentions", label: "Mentions légales", href: "/mentions-legales", icon: <Info className="h-5 w-5" />, active: pathname === "/mentions-legales" },
  ];

  if (!isAuthed) {
    // ── Anonymous ──
    const items: BottomNavItem[] = [
      { key: "home", label: "Accueil", href: "/", icon: <House className="h-5 w-5" />, active: pathname === "/" },
      { key: "search", label: "Recherche", href: "/search", icon: <Search className="h-5 w-5" />, active: pathname.startsWith("/search") },
      { key: "login", label: "Connexion", href: "/login", icon: <LogIn className="h-5 w-5" />, active: pathname === "/login" },
    ];
    return <MobileBottomNav items={items} moreItems={moreCommon} />;
  }

  if (isSitter) {
    // ── Sitter (also has owner side) ──
    const items: BottomNavItem[] = [
      { key: "home", label: "Accueil", href: "/", icon: <House className="h-5 w-5" />, active: pathname === "/" },
      { key: "requests", label: "Demandes", href: "/host/requests", icon: <Inbox className="h-5 w-5" />, active: pathname.startsWith("/host/requests") },
      { key: "messages", label: "Messages", href: "/host/messages", icon: <MessageCircle className="h-5 w-5" />, active: pathname.startsWith("/host/messages") },
    ];
    const moreSitter: BottomNavItem[] = [
      { key: "host-dashboard", label: "Tableau de bord sitter", href: "/host", icon: <Shield className="h-5 w-5" />, active: pathname === "/host" },
      { key: "account", label: "Mon compte (owner)", href: "/account", icon: <Heart className="h-5 w-5" />, active: pathname === "/account" },
      ...(role === "ADMIN" ? [{ key: "admin", label: "Admin", href: "/admin/dashboard", icon: <Shield className="h-5 w-5" />, active: pathname.startsWith("/admin") }] : []),
      ...moreCommon,
      { key: "logout", label: "Déconnexion", href: "/sign-out", icon: <LogOut className="h-5 w-5" />, active: false },
    ];
    return <MobileBottomNav items={items} moreItems={moreSitter} />;
  }

  // ── Owner (authed, not sitter) ──
  const items: BottomNavItem[] = [
    { key: "home", label: "Accueil", href: "/", icon: <House className="h-5 w-5" />, active: pathname === "/" },
    { key: "bookings", label: "Réservations", href: "/account/bookings", icon: <Calendar className="h-5 w-5" />, active: pathname.startsWith("/account/bookings") },
    { key: "messages", label: "Messages", href: "/account/messages", icon: <MessageCircle className="h-5 w-5" />, active: pathname.startsWith("/account/messages") },
  ];
  const moreOwner: BottomNavItem[] = [
    { key: "account", label: "Mon compte", href: "/account", icon: <Heart className="h-5 w-5" />, active: pathname === "/account" },
    { key: "devenir-sitter", label: "Devenir dogsitter", href: "/devenir-dogsitter", icon: <HelpCircle className="h-5 w-5" />, active: pathname === "/devenir-dogsitter" },
    ...(role === "ADMIN" ? [{ key: "admin", label: "Admin", href: "/admin/dashboard", icon: <Shield className="h-5 w-5" />, active: pathname.startsWith("/admin") }] : []),
    ...moreCommon.filter((m) => m.key !== "devenir-sitter"),
    { key: "logout", label: "Déconnexion", href: "/sign-out", icon: <LogOut className="h-5 w-5" />, active: false },
  ];
  return <MobileBottomNav items={items} moreItems={moreOwner} />;
}
