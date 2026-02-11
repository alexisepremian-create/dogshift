"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
};

type DashboardMobileNavProps = {
  primaryItems: NavItem[];
  moreItems: NavItem[];
  moreLabel: string;
  moreIcon: React.ReactNode;
  onCloseMore?: () => void;
  onSignOut?: () => void;
  signOutLabel?: string;
};

export default function DashboardMobileNav({
  primaryItems,
  moreItems,
  moreLabel,
  moreIcon,
  onCloseMore,
  onSignOut,
  signOutLabel,
}: DashboardMobileNavProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const bottomItems = useMemo(() => primaryItems.slice(0, 3), [primaryItems]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    if (typeof onCloseMore === "function") onCloseMore();
    const t = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(t);
  }, [mounted, open, onCloseMore]);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[520px] items-center justify-between px-4 pt-2">
          {bottomItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-xs font-semibold transition " +
                (item.active ? "text-slate-900" : "text-slate-700")
              }
              prefetch={false}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-xs font-semibold text-slate-700"
          >
            {moreIcon}
            {moreLabel}
          </button>
        </div>
      </div>

      {mounted ? (
        <div
          className={
            "fixed inset-0 z-[80] lg:hidden transition-opacity duration-200 ease-out" +
            (open ? " opacity-100" : " pointer-events-none opacity-0")
          }
          role="dialog"
          aria-modal="true"
          aria-label={moreLabel}
        >
          <button
            type="button"
            className={
              "absolute inset-0 bg-slate-950/35 transition-opacity duration-200 ease-out" +
              (open ? " opacity-100" : " opacity-0")
            }
            aria-label="Fermer"
            onClick={() => setOpen(false)}
          />

          <div
            ref={panelRef}
            className={
              "absolute inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-3xl border border-slate-200 bg-white shadow-[0_-18px_60px_-44px_rgba(2,6,23,0.45)] transition-transform duration-200 ease-out" +
              (open ? " translate-y-0" : " translate-y-6")
            }
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
              <p className="text-sm font-semibold text-slate-900">{moreLabel}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              >
                Fermer
              </button>
            </div>

            <nav aria-label={moreLabel} className="px-5 pb-4">
              <div className="grid gap-2">
                {moreItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={
                      "rounded-2xl px-4 py-3 text-base font-semibold ring-1 ring-slate-200 transition " +
                      (item.active ? "bg-slate-50 text-slate-900" : "bg-white text-slate-900 hover:bg-slate-50")
                    }
                    prefetch={false}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              {onSignOut ? (
                <>
                  <div className="mt-4 h-px w-full bg-slate-200" />
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSignOut();
                    }}
                    className="mt-4 w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
                  >
                    {signOutLabel ?? "Déconnexion"}
                  </button>
                </>
              ) : null}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
