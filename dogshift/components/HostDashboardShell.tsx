"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";

import HostSidebar from "@/components/HostSidebar";
import HostTermsModal from "@/components/HostTermsModal";
import NotificationBell from "@/components/NotificationBell";
import { markHostMounted } from "@/components/globalTransitionStore";

export default function HostDashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode = (searchParams?.get("mode") ?? "").trim();
  const isPublicPreview = pathname?.startsWith("/sitter/") && mode === "preview";

  useEffect(() => {
    markHostMounted();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {isPublicPreview ? null : <HostTermsModal />}
      <div className="flex min-h-screen">
        <div className="hidden w-[240px] shrink-0 lg:block">
          <HostSidebar className="sticky top-0 h-screen" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 bg-white/80 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                  aria-label="Ouvrir le menu"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>

                <Link href="/" className="text-sm font-semibold text-slate-700 hover:text-slate-900 lg:hidden">
                  DogShift
                </Link>
              </div>

              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto w-full max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
          />

          <div className="absolute left-0 top-0 h-full w-[280px] bg-white shadow-[0_20px_60px_-35px_rgba(2,6,23,0.45)]">
            <div className="flex items-center justify-end px-4 pt-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <HostSidebar
              className="h-[calc(100%-56px)] border-r-0"
              onNavigate={() => {
                setMobileOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
