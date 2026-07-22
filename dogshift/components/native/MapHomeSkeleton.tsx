"use client";

import { Search } from "lucide-react";

/**
 * Loading skeleton for the native HOME map screen (`/`).
 *
 * This is a FAITHFUL replica of NativeMapHome's own loading state — the same
 * white search pill, the same service chips, the same collapsed bottom sheet
 * ("Chargement…" header + a horizontal row of sitter-card skeletons). So when
 * the route fallback hands off to the real NativeMapHome, nothing visually
 * changes except the map tiles fading in behind — it reads as ONE continuous
 * load, not two skeletons (founder: "j'en veux qu'un pour chaque page").
 *
 * Rendered `fixed inset-0 z-0` (below the z-50 bottom nav) so the nav stays
 * visible, exactly like NativeMapHome.
 */
const SERVICES = ["Promenade", "Garde", "Pension"];

export default function MapHomeSkeleton() {
  return (
    <div className="fixed inset-0 z-0 bg-slate-100">
      {/* Search bar + service chips — identical to NativeMapHome's chrome */}
      <div
        className="absolute left-0 right-0 z-20 space-y-2 px-2"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 4px)" }}
      >
        <div className="flex w-full items-center gap-2 rounded-full bg-white/95 px-4 py-3 text-left shadow-[0_8px_24px_rgba(2,6,23,0.18)]">
          <Search className="h-5 w-5 text-slate-500" />
          <span className="flex-1 truncate text-base text-slate-400">Lieu, dates, service…</span>
        </div>
        <div className="flex gap-2 overflow-x-hidden pb-1 -mx-1 px-1">
          {SERVICES.map((s) => (
            <span
              key={s}
              className="flex-shrink-0 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_4px_12px_rgba(2,6,23,0.12)]"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Collapsed bottom sheet (loading) — identical to NativeMapHome */}
      <div
        className="absolute left-2 right-2 z-30 rounded-3xl bg-white shadow-[0_-8px_24px_rgba(2,6,23,0.14)]"
        style={{
          bottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 16px)",
          height: "148px",
        }}
      >
        <div className="flex w-full flex-col items-center pt-2 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-slate-300" />
        </div>
        <div className="flex items-baseline justify-between px-4 pt-1 pb-2">
          <h2 className="text-base font-semibold text-slate-900">Chargement…</h2>
          <span className="text-sm font-medium text-[var(--dogshift-blue)]">Filtres</span>
        </div>
        {/* Card row — PIXEL-IDENTICAL to NativeMapHome's collapsed cards (same
            overflow-y-auto px-4 wrapper, same overflow-x-auto -mx-4 px-5 scroller,
            same card box: border-slate-200, h-10 w-10 shrink-0 avatar, 3 lines) so
            the skeleton→real hand-off on return doesn't nudge the cards. */}
        <div className="overflow-y-auto px-4 pb-3" style={{ maxHeight: "86px" }}>
          <div className="flex gap-3 overflow-x-auto -mx-4 px-5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[160px] flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2"
              >
                <div className="ds-skel h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="ds-skel ds-skel-line w-full" />
                  <div className="ds-skel ds-skel-line w-2/3" />
                  <div className="ds-skel ds-skel-line w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
