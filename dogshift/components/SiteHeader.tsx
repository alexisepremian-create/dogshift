"use client";

import Link from "next/link";
import {
  HelpCircle,
  House,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Search,
  ShoppingBag,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import MobileSearchOverlay from "@/components/MobileSearchOverlay";
import NotificationBell from "@/components/NotificationBell";

type AccountContextPayload = {
  ok?: boolean;
  monEspaceHref?: string;
};

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [navMounted, setNavMounted] = useState(false);
  const [navAnimating, setNavAnimating] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountHref, setAccountHref] = useState("/account");
  const { isLoaded, isSignedIn, user } = useUser();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHomepage = pathname === "/";
  const isHostArea = Boolean(pathname && pathname.startsWith("/host"));
  const isAccountArea = Boolean(pathname && pathname.startsWith("/account"));
  const isHostPreview = Boolean(
    pathname &&
      pathname.startsWith("/sitter/") &&
      (searchParams?.get("mode") ?? "") === "preview" &&
      isLoaded &&
      isSignedIn,
  );

  const signOutRedirectUrl = "/login?force=1";
  async function handleSignOut() {
    window.location.assign(`/sign-out?redirect=${encodeURIComponent(signOutRedirectUrl)}`);
  }

  useEffect(() => { setHasMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setHeaderHidden(isHomepage && window.scrollY > 70);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHomepage]);

  useEffect(() => {
    if (navOpen) {
      setNavMounted(true);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setNavAnimating(true));
      });
      return () => {
        cancelAnimationFrame(frame);
        document.body.style.overflow = prevOverflow;
      };
    }
    setNavAnimating(false);
    document.body.style.overflow = "";
    if (!navMounted) return;
    const t = window.setTimeout(() => setNavMounted(false), 400); // 400ms duration for fade/slide
    return () => window.clearTimeout(t);
  }, [navOpen, navMounted]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setAccountHref("/account"); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/account/context", { method: "GET", cache: "no-store" });
        const payload = (await res.json().catch(() => null)) as AccountContextPayload | null;
        if (cancelled) return;
        setAccountHref(typeof payload?.monEspaceHref === "string" ? payload.monEspaceHref : "/account");
      } catch {
        if (cancelled) return;
        setAccountHref("/account");
      }
    })();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  if (isHostArea || isAccountArea || isHostPreview) return null;

  const userInitials = user?.firstName?.[0] ?? user?.username?.[0] ?? "";

  return (
    <>
      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <header
        className={[
          "fixed inset-x-0 z-50 h-16 transition-all duration-300 ease-out",
          headerHidden ? "pointer-events-none -translate-y-full opacity-0" : "",
          scrolled
            ? "bg-white/95 shadow-[0_1px_0_0_rgba(2,6,23,0.07)] backdrop-blur-md"
            : "bg-transparent",
        ].join(" ")}
        style={{ top: "var(--ds-maintenance-banner-height, 0px)" }}
      >
        <div className="flex h-full items-center justify-between px-4 pt-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <BrandLogo href="/" priority />

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            {hasMounted && isLoaded && isSignedIn ? <NotificationBell /> : null}

            {/* Mobile search */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Recherche rapide"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] md:hidden"
            >
              <Search className="h-4 w-4 text-slate-700" strokeWidth={2.25} aria-hidden="true" />
            </button>

            {/* Devenir dogsitter — desktop text link */}
            <Link
              href="/devenir-dogsitter"
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 md:inline-block"
            >
              Devenir dogsitter
            </Link>

            {/* Auth links — desktop only */}
            {hasMounted && isLoaded ? (
              isSignedIn ? (
                <Link
                  href={accountHref}
                  prefetch={false}
                  className="hidden text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900 md:inline-block"
                >
                  Mon espace
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="hidden text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900 md:inline-block"
                >
                  Se connecter
                </Link>
              )
            ) : null}

            {/* Hamburger pill */}
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={navOpen}
              aria-label="Menu de navigation"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              <Menu className="h-4 w-4 text-slate-700" strokeWidth={2.25} aria-hidden="true" />
              <span
                className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[10px] font-bold text-slate-600"
                aria-hidden="true"
              >
                {hasMounted && isLoaded && isSignedIn && userInitials ? (
                  userInitials.toUpperCase()
                ) : (
                  <User className="h-4 w-4 text-slate-500" strokeWidth={2.25} />
                )}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Right-side nav panel ────────────────────────────────────────────── */}
      {navMounted ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
          className={[
            "fixed inset-0 z-[80]",
            navAnimating ? "" : "pointer-events-none",
          ].join(" ")}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setNavOpen(false)}
            className={[
              "absolute inset-0 cursor-default bg-slate-950/30 backdrop-blur-[2px] transition-opacity duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              navAnimating ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />

          {/* Panel — slides from right */}
          <div
            className={[
              "absolute inset-y-0 right-0 flex w-[320px] max-w-[calc(100vw-2.5rem)] flex-col bg-white shadow-[-20px_0_60px_-20px_rgba(2,6,23,0.20)] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              navAnimating ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
            ].join(" ")}
            style={{
              paddingTop: "max(1.25rem, env(safe-area-inset-top))",
              paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
            }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 pb-4">
              <BrandLogo href="/" />
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Nav links */}
            <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-5">
              <div className="grid gap-0.5">
                {(
                  [
                    { href: "/", icon: House, label: "Accueil" },
                    { href: "/search", icon: Search, label: "Trouver un sitter" },
                    { href: "/devenir-dogsitter", icon: UserPlus, label: "Devenir dogsitter" },
                    { href: "/become-sitter/access", icon: LogIn, label: "Accès sitter" },
                    { href: "/shop", icon: ShoppingBag, label: "Boutique" },
                    { href: "/help", icon: HelpCircle, label: "Centre d'aide" },
                  ] as { href: string; icon: React.ElementType; label: string }[]
                ).map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setNavOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    {label}
                  </Link>
                ))}
              </div>

              <div className="my-4 h-px bg-slate-100" />

              {/* Auth zone */}
              <div className="grid gap-2">
                {hasMounted && isLoaded ? (
                  isSignedIn ? (
                    <>
                      <Link
                        href={accountHref}
                        prefetch={false}
                        onClick={() => setNavOpen(false)}
                        className="flex items-center gap-3 rounded-xl bg-[var(--dogshift-blue)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--dogshift-blue-hover)]"
                      >
                        <LayoutDashboard className="h-4 w-4 text-blue-300" aria-hidden="true" />
                        Mon espace
                      </Link>
                      <button
                        type="button"
                        onClick={() => { setNavOpen(false); void handleSignOut(); }}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <LogOut className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        Se déconnecter
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setNavOpen(false)}
                      className="flex items-center gap-3 rounded-xl bg-[var(--dogshift-blue)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--dogshift-blue-hover)]"
                    >
                      <User className="h-4 w-4 text-blue-300" aria-hidden="true" />
                      Se connecter / Créer un compte
                    </Link>
                  )
                ) : null}
              </div>
            </nav>
          </div>
        </div>
      ) : null}

      <MobileSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

// react import needed for JSX element type in inline cast
import React from "react";
