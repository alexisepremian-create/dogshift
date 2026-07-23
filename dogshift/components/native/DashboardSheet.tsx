"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { InDashboardSheetContext, PanelSpinner } from "@/components/native/dashboardSheetContext";

/**
 * Floating slide-up sheet for the native dashboards — identical geometry to the
 * in-popup reservation fiche (`left-2 right-2`, rounded on all corners, sits
 * below the status bar and above the bottom nav). Tapping a dashboard tile opens
 * the destination in this overlay instead of a hard page navigation. Native-only.
 */
export function DashboardSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Defer mounting the (potentially heavy) panel until the sheet + spinner have
  // painted. The destination pages — availability especially (~3000 lines of
  // hooks before its early-return), wallet, settings — run a long SYNCHRONOUS
  // first render. If we mount them in the same frame the sheet opens, that long
  // task drops the spinner's very first frames → the founder sees the spinner
  // "lag/bug" on open. Instead we paint an identical PanelSpinner first (its
  // transform layer gets promoted — see the .animate-spin rule in globals.css),
  // then mount the panel two frames later. While the panel's heavy render runs,
  // React hasn't committed yet, so the already-composited spinner keeps rotating
  // on the compositor thread; the panel's own identical spinner then replaces it
  // seamlessly. Reset when the sheet closes so the next open re-defers.
  const [bodyReady, setBodyReady] = useState(false);
  useEffect(() => {
    if (!open) return;
    let r1 = 0;
    let r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setBodyReady(true));
    });
    // Reset on close/unmount (in cleanup, not synchronously in the body) so the
    // next open re-defers the mount behind a freshly-painted spinner.
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      setBodyReady(false);
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[1200] bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed left-2 right-2 z-[1201] flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(2,6,23,0.30)]"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 70px)",
          bottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 8px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header — back arrow (left) + close (right), same as the reservation fiche */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-base font-semibold text-slate-900 active:opacity-70"
            aria-label="Retour"
            style={{ touchAction: "manipulation" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body — flag the subtree as "in a sheet" so panel pages
            render a spinner (not a skeleton) while loading. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          <InDashboardSheetContext.Provider value={true}>
            {bodyReady ? children : <PanelSpinner />}
          </InDashboardSheetContext.Provider>
        </div>
      </div>
    </>
  );
}
