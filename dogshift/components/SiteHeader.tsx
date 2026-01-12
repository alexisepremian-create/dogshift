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
  const [menuOpen, setMenuOpen] = useState(false);
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
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

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
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={ctaClassName}
            >
              <Menu className={ctaIconClassName} aria-hidden="true" />
              Menu
            </button>

            {menuOpen ? (
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
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <LayoutDashboard className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      Mon espace
                    </Link>
                    <Link
                      role="menuitem"
                      href="/help"
                      onClick={() => setMenuOpen(false)}
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
                        setMenuOpen(false);
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
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <User className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      Connexion
                    </Link>
                    <Link
                      role="menuitem"
                      href="/help"
                      onClick={() => setMenuOpen(false)}
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
    </>
  );
}
