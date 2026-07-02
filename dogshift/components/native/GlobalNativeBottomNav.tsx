"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  House,
  Heart,
  Calendar,
  MessageCircle,
  Inbox,
  Info,
  HelpCircle,
  ScrollText,
  Shield,
  Lock,
  Mail,
  LogOut,
  User,
} from "lucide-react";

import { type BottomNavItem } from "@/components/MobileBottomNav";
import NativeTabBar from "@/components/native/NativeTabBar";
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
  // Seed from a persisted flag so a returning sitter doesn't see the bottom nav
  // flip owner→sitter (Réservations/calendar icon → Demandes/inbox icon) at
  // launch while fetchAccountContext resolves (founder bug: "la nav barre pour
  // l'onglet réservation change au lancement"). fetchAccountContext then
  // confirms/updates it and re-persists.
  const [isSitter, setIsSitter] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("ds_is_sitter") === "1";
    } catch {
      return false;
    }
  });

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
        const value = Boolean(ctx?.hasSitterProfile);
        setIsSitter(value);
        try {
          window.localStorage.setItem("ds_is_sitter", value ? "1" : "0");
        } catch {
          // ignore storage errors (private mode, etc.)
        }
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

  // The native app is auth-gated: an unauthenticated user is confined to the
  // login/signup flow and must NOT be able to navigate anywhere else. Hiding the
  // tab bar entirely (rather than showing anonymous tabs) is what enforces that
  // — there are simply no nav targets to tap until they sign in.
  if (!isAuthed) return null;

  // Shared "Plus" overflow items
  const moreCommon: BottomNavItem[] = [
    { key: "devenir-sitter", label: "Devenir dogsitter", href: "/devenir-dogsitter", icon: <HelpCircle className="h-5 w-5" />, active: pathname === "/devenir-dogsitter" },
    { key: "contact", label: "Contact", href: "/contact", icon: <Mail className="h-5 w-5" />, active: pathname === "/contact" },
    { key: "cgu", label: "Conditions d'utilisation", href: "/cgu", icon: <ScrollText className="h-5 w-5" />, active: pathname === "/cgu" },
    { key: "confidentialite", label: "Confidentialité", href: "/confidentialite", icon: <Lock className="h-5 w-5" />, active: pathname === "/confidentialite" },
    { key: "mentions", label: "Mentions légales", href: "/mentions-legales", icon: <Info className="h-5 w-5" />, active: pathname === "/mentions-legales" },
  ];

  if (isSitter) {
    // ── Sitter (also has owner side) ──
    // 4 flanking tabs (2 left of the center logo, 2 right). The person icon →
    // the sitter dashboard (/host). The center DogShift logo opens `moreItems`.
    const items: BottomNavItem[] = [
      { key: "home", label: "Accueil", href: "/", icon: <House className="h-5 w-5" />, active: pathname === "/" },
      { key: "requests", label: "Demandes", href: "/host/requests", icon: <Inbox className="h-5 w-5" />, active: pathname.startsWith("/host/requests") },
      { key: "messages", label: "Messages", href: "/host/messages", icon: <MessageCircle className="h-5 w-5" />, active: pathname.startsWith("/host/messages") },
      { key: "dashboard", label: "Tableau", href: "/host", icon: <User className="h-5 w-5" />, active: pathname === "/host" },
    ];
    const moreSitter: BottomNavItem[] = [
      { key: "account", label: "Mon compte (owner)", href: "/account", icon: <Heart className="h-5 w-5" />, active: pathname === "/account" },
      ...(role === "ADMIN" ? [{ key: "admin", label: "Admin", href: "/admin/dashboard", icon: <Shield className="h-5 w-5" />, active: pathname.startsWith("/admin") }] : []),
      ...moreCommon,
      { key: "logout", label: "Déconnexion", href: "/sign-out", icon: <LogOut className="h-5 w-5" />, active: false },
    ];
    return <NativeTabBar items={items} moreItems={moreSitter} />;
  }

  // ── Owner (authed, not sitter) ──
  const items: BottomNavItem[] = [
    { key: "home", label: "Accueil", href: "/", icon: <House className="h-5 w-5" />, active: pathname === "/" },
    { key: "bookings", label: "Réservations", href: "/account/bookings", icon: <Calendar className="h-5 w-5" />, active: pathname.startsWith("/account/bookings") },
    { key: "messages", label: "Messages", href: "/account/messages", icon: <MessageCircle className="h-5 w-5" />, active: pathname.startsWith("/account/messages") },
    { key: "dashboard", label: "Tableau", href: "/account", icon: <User className="h-5 w-5" />, active: pathname === "/account" },
  ];
  const moreOwner: BottomNavItem[] = [
    { key: "devenir-sitter", label: "Devenir dogsitter", href: "/devenir-dogsitter", icon: <HelpCircle className="h-5 w-5" />, active: pathname === "/devenir-dogsitter" },
    ...(role === "ADMIN" ? [{ key: "admin", label: "Admin", href: "/admin/dashboard", icon: <Shield className="h-5 w-5" />, active: pathname.startsWith("/admin") }] : []),
    ...moreCommon.filter((m) => m.key !== "devenir-sitter"),
    { key: "logout", label: "Déconnexion", href: "/sign-out", icon: <LogOut className="h-5 w-5" />, active: false },
  ];
  return <NativeTabBar items={items} moreItems={moreOwner} />;
}
