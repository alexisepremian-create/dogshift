"use client";

import Link from "next/link";
import { Menu, LogOut, HelpCircle, LayoutDashboard, User } from "lucide-react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import NotificationBell from "@/components/NotificationBell";

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileNavMounted, setMobileNavMounted] = useState(false);
  const { isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHome = pathname === "/";
  const isHostArea = Boolean(pathname && pathname.startsWith("/host"));
  const isAccountArea = Boolean(pathname && pathname.startsWith("/account"));
  const isHostPreview = Boolean(pathname && pathname.startsWith("/sitter/") && (searchParams?.get("mode") ?? "") === "preview");

  const accountHref = "/account";

  const menuRef = useRef<HTMLDivElement | null>(null);

  const navLinkClassName = useMemo(() => {
    const size = scrolled ? "text-sm" : "text-base";
    return `${size} font-medium text-slate-600 transition-all duration-200 ease-out hover:text-slate-900 hover:opacity-90 hover:underline hover:underline-offset-4`;
  }, [scrolled]);

  const ctaClassName = useMemo(() => {
    const size = scrolled ? "text-sm" : "text-base";
    const pad = scrolled ? "px-4 py-2" : "px-5 py-3";
    return `inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white ${pad} ${size} font-semibold text-slate-900 transition-all duration-200 ease-out hover:bg-slate-50 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]`;
  }, [scrolled]);

  const ctaIconClassName = useMemo(() => (scrolled ? "h-4 w-4" : "h-5 w-5"), [scrolled]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setUserMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (mobileNavOpen) {
      setMobileNavMounted(true);
      return;
    }
    if (!mobileNavMounted) return;
    const t = window.setTimeout(() => setMobileNavMounted(false), 180);
    return () => window.clearTimeout(t);
  }, [mobileNavMounted, mobileNavOpen]);

  if (isHostArea || isAccountArea || isHostPreview) return null;

  const authMenuOffset = scrolled ? "-mt-[35px]" : "-mt-[56px]";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40">
        <div
          className={
            "pointer-events-auto flex items-center justify-between px-4 transition-all duration-200 ease-out sm:px-6" +
            (scrolled ? " py-2" : " py-5")
          }
        >
          <div className={"origin-left transition-transform duration-200 ease-out" + (scrolled ? " scale-100" : " scale-[1.18]")}
          >
            <BrandLogo href="/" priority />
          </div>

          <div
            ref={menuRef}
            className={authMenuOffset + " relative flex items-center gap-2 transition-all duration-200 ease-out"}
          >
            {isLoaded && isSignedIn ? <NotificationBell /> : null}

            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={mobileNavOpen}
              className={ctaClassName + " md:hidden"}
            >
              <Menu className={ctaIconClassName} aria-hidden="true" />
              Menu
            </button>

            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className={ctaClassName + " hidden md:inline-flex"}
            >
              <Menu className={ctaIconClassName} aria-hidden="true" />
              Menu
            </button>

            {userMenuOpen ? (
              <div
                role="menu"
                aria-label="Menu utilisateur"
                className="absolute right-0 top-0 z-10 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_-40px_rgba(2,6,23,0.25)]"
              >
                {isLoaded && isSignedIn ? (
                  <>
                    <Link
                      role="menuitem"
                      href={accountHref}
                      prefetch={false}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <LayoutDashboard className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      Mon espace
                    </Link>
                    <Link
                      role="menuitem"
                      href="/help"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <HelpCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      Centre d’aide
                    </Link>
                    <div className="h-px w-full bg-slate-200" />
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        void clerk.signOut({ redirectUrl: "/login" });
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <LogOut className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      Se déconnecter
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      role="menuitem"
                      href="/login"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <User className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      Connexion
                    </Link>
                    <Link
                      role="menuitem"
                      href="/help"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <HelpCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      Centre d’aide
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={
          scrolled
            ? `fixed left-1/2 top-4 z-50 hidden -translate-x-1/2 items-center rounded-full border border-slate-200/70 bg-white/80 px-6 ${
                isHome ? "shadow-[0_18px_60px_-44px_rgba(2,6,23,0.25)]" : "shadow-none"
              } backdrop-blur md:flex`
            : `fixed left-1/2 top-4 z-50 hidden -translate-x-1/2 items-center rounded-full border border-slate-200/70 bg-white px-8 ${
                isHome ? "shadow-[0_18px_60px_-44px_rgba(2,6,23,0.18)]" : "shadow-none"
              } md:flex`
        }
      >
        <nav
          aria-label="Navigation principale"
          className={
            "flex items-center transition-all duration-200 ease-out" +
            (scrolled ? " gap-8 py-3" : " gap-10 py-5")
          }
        >
          <Link href="/" className={navLinkClassName}>
            Accueil
          </Link>
          <Link href="/search" className={navLinkClassName}>
            Trouver un sitter
          </Link>
          <Link href="/become-sitter" className={navLinkClassName}>
            Devenir dogsitter
          </Link>
          <Link href="/shop" className={navLinkClassName}>
            Boutique
          </Link>
        </nav>
      </div>

      {mobileNavMounted ? (
        <div
          className={
            "fixed inset-0 z-[60] md:hidden transition-opacity duration-200 ease-out" +
            (mobileNavOpen ? " opacity-100" : " pointer-events-none opacity-0")
          }
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <button
            type="button"
            className={
              "absolute inset-0 bg-slate-950/35 transition-opacity duration-200 ease-out" +
              (mobileNavOpen ? " opacity-100" : " opacity-0")
            }
            aria-label="Fermer le menu"
            onClick={() => setMobileNavOpen(false)}
          />

          <div
            className={
              "absolute inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-3xl border border-slate-200 bg-white shadow-[0_-18px_60px_-44px_rgba(2,6,23,0.45)] transition-transform duration-200 ease-out" +
              (mobileNavOpen ? " translate-y-0" : " translate-y-6")
            }
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
              <p className="text-sm font-semibold text-slate-900">Menu</p>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              >
                Fermer
              </button>
            </div>

            <nav aria-label="Navigation principale" className="px-5 pb-4">
              <div className="grid gap-2">
                <Link
                  href="/"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-2xl px-4 py-3 text-base font-semibold text-slate-900 ring-1 ring-slate-200"
                >
                  Accueil
                </Link>
                <Link
                  href="/search"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-2xl px-4 py-3 text-base font-semibold text-slate-900 ring-1 ring-slate-200"
                >
                  Trouver un sitter
                </Link>
                <Link
                  href="/become-sitter"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-2xl px-4 py-3 text-base font-semibold text-slate-900 ring-1 ring-slate-200"
                >
                  Devenir dogsitter
                </Link>
                <Link
                  href="/shop"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-2xl px-4 py-3 text-base font-semibold text-slate-900 ring-1 ring-slate-200"
                >
                  Boutique
                </Link>
              </div>

              <div className="mt-4 h-px w-full bg-slate-200" />

              <div className="mt-4 grid gap-2">
                {isLoaded && isSignedIn ? (
                  <>
                    <Link
                      href={accountHref}
                      prefetch={false}
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
                    >
                      Mon espace
                    </Link>
                    <Link
                      href="/help"
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
                    >
                      Centre d’aide
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileNavOpen(false);
                        void clerk.signOut({ redirectUrl: "/login" });
                      }}
                      className="rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
                    >
                      Se déconnecter
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
                    >
                      Connexion
                    </Link>
                    <Link
                      href="/help"
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
                    >
                      Centre d’aide
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
