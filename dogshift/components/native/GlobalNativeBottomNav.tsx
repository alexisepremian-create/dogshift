"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { House, Calendar, MessageCircle, Inbox, User } from "lucide-react";

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
  const { status } = useSession();
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

  // Resolve "does this user belong on the sitter dashboard?".
  //
  // IMPORTANT: this must be gated on ACTIVATION, not on merely having a
  // SitterProfile. A user who is an OWNER with a non-activated sitter profile
  // (e.g. contract signed but never activated) is treated as a sitter by the
  // nav if we key off `hasSitterProfile` — so every tab points to /host*, which
  // the /host layout correctly bounces back to /account (HOST_NOT_ACTIVATED).
  // That /account⇄/host bounce (amplified by Next prefetching the /host links)
  // left the owner dashboard stuck on its skeleton. `monEspaceHref` already
  // encodes the server's decision (`activated ? "/host" : "/account"`), so use
  // it as the single source of truth.
  useEffect(() => {
    // Only a CONFIRMED sign-out resets to owner. Critically, do NOT reset while
    // the session is still "loading": that used to clobber the persisted
    // `ds_is_sitter` seed with `false`, so a returning sitter's nav flashed the
    // OWNER tabs (Réservations) before flipping to sitter (Demandes) once the
    // session resolved. Keeping the seed during "loading" shows the correct tab
    // from the first painted frame (founder: "mets directement la bonne icône").
    if (status === "unauthenticated") {
      setIsSitter(false);
      try { window.localStorage.setItem("ds_is_sitter", "0"); } catch {}
      return;
    }
    if (status !== "authenticated") return; // "loading" → trust the persisted seed
    let cancelled = false;
    (async () => {
      try {
        const ctx = await fetchAccountContext();
        if (cancelled) return;
        const value = ctx?.monEspaceHref === "/host";
        setIsSitter(value);
        try {
          window.localStorage.setItem("ds_is_sitter", value ? "1" : "0");
        } catch {
          // ignore storage errors (private mode, etc.)
        }
      } catch {
        // Keep the current (seeded) value on error — never flip to owner blindly.
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

  const isAuthed = status === "authenticated";

  // The native app is auth-gated: an unauthenticated user is confined to the
  // login/signup flow and must NOT be able to navigate anywhere else. Hiding the
  // tab bar entirely (rather than showing anonymous tabs) is what enforces that
  // — there are simply no nav targets to tap until they sign in.
  if (!isAuthed) return null;

  // NB: the old "more menu" (Mon compte, Admin, legal, Déconnexion…) used to open
  // from the center FAB. The center FAB now opens the breeding "Rencontres"
  // feature, so that menu moved to the homepage search-bar button — built by the
  // shared `useNativeMenuItems()` hook (single source of truth).
  if (isSitter) {
    const items: BottomNavItem[] = [
      { key: "home", label: "Accueil", href: "/", icon: <House className="h-6 w-6" />, active: pathname === "/" },
      { key: "requests", label: "Demandes", href: "/host/requests", icon: <Inbox className="h-6 w-6" />, active: pathname.startsWith("/host/requests") },
      { key: "messages", label: "Messages", href: "/host/messages", icon: <MessageCircle className="h-6 w-6" />, active: pathname.startsWith("/host/messages") },
      { key: "dashboard", label: "Compte", href: "/host", icon: <User className="h-6 w-6" />, active: pathname === "/host" },
    ];
    return <NativeTabBar items={items} />;
  }

  // ── Owner (authed, not sitter) ──
  const items: BottomNavItem[] = [
    { key: "home", label: "Accueil", href: "/", icon: <House className="h-6 w-6" />, active: pathname === "/" },
    { key: "bookings", label: "Réservations", href: "/account/bookings", icon: <Calendar className="h-6 w-6" />, active: pathname.startsWith("/account/bookings") },
    { key: "messages", label: "Messages", href: "/account/messages", icon: <MessageCircle className="h-6 w-6" />, active: pathname.startsWith("/account/messages") },
    { key: "dashboard", label: "Compte", href: "/account", icon: <User className="h-6 w-6" />, active: pathname === "/account" },
  ];
  return <NativeTabBar items={items} />;
}
