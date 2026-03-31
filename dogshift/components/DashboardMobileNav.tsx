"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { House, Menu, X, LogOut } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

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
  onSignOut,
  signOutLabel,
}: DashboardMobileNavProps) {
  const [open, setOpen] = useState(false);

  const allItems = [...primaryItems, ...moreItems];

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

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[70] flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <BrandLogo href="/" priority />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition-all duration-200 ease-out hover:bg-slate-50 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          Menu
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-white lg:hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <BrandLogo href="/" priority />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6">
            <nav className="grid gap-2">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                <House className="h-5 w-5 text-slate-500" aria-hidden="true" />
                <span>Accueil</span>
              </Link>

              {allItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold transition ${
                    item.active ? "bg-slate-50 text-slate-900" : "text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <span className={item.active ? "text-[var(--dogshift-blue)]" : "text-slate-500"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}

              {onSignOut && (
                <>
                  <div className="my-4 h-px w-full bg-slate-200" />
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSignOut();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    <LogOut className="h-5 w-5 text-slate-500" aria-hidden="true" />
                    <span>{signOutLabel ?? "Déconnexion"}</span>
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
