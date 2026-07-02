"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * Full-height slide-up sheet for the native dashboards — same idea as the
 * in-popup reservation flow: tapping a dashboard tile opens the destination in
 * this overlay instead of a hard page navigation. Native-only (only ever
 * mounted inside the `ds-native-only` dashboard branch).
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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[1200] bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed inset-x-0 bottom-0 z-[1201] flex flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-20px_60px_rgba(2,6,23,0.25)]"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Retour"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 active:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="text-base font-bold text-slate-900">{title}</p>
        </div>

        {/* Scrollable body */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
          style={{ paddingBottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 16px)" }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
