"use client";

import { ClipboardList, Plus } from "lucide-react";

/**
 * Route-level loading skeletons that FAITHFULLY replicate each section page's
 * own loading view — INCLUDING the exact shell + page nesting/padding, so the
 * skeleton content sits at the PIXEL-IDENTICAL position as the real page. When
 * the page mounts (showing the same chrome + the same skeleton list during its
 * client fetch) nothing moves → one continuous skeleton, no flash.
 *
 * The host/account layouts are force-dynamic and their DB read is SLOW, so this
 * route fallback is on screen for a real moment — it MUST be a skeleton, not a
 * blank (returning null here painted a white screen = the regression we undid).
 *
 * Card counts are kept low (3 / 4) so the list never exceeds the space above
 * the nav → nothing spills under the bottom nav.
 *
 * Rendered `fixed inset-0 z-40` (below the z-50 nav): the overlay covers the
 * WHOLE viewport the instant it mounts, so the brief transition gap — the white
 * body, or maplibre's WebGL canvas going white as the home map is torn down —
 * is hidden behind the skeleton instead of flashing (founder: "mini flash page
 * blanche quand je vais sur réservations"). Content scrolls inside it.
 *
 * Mirrors the shell: top padding = safe-area + banner + 2rem, white bg, the
 * `py-3` inner wrapper and the `px-1` nesting levels.
 */

// Match HostDashboardShell's native <main> top padding EXACTLY (safe-area +
// banner + 0.5rem); the inner `pt-1` (below) adds the shell's 0.25rem so the
// header lands at the identical 0.75rem it sits at once the real page mounts in
// the shell — no vertical jump. (Was 2rem + an extra py-3 → ~20px downward shift.)
const ROOT_PT = "calc(env(safe-area-inset-top, 0px) + var(--ds-maintenance-banner-height, 0px) + 0.5rem)";
// `data-ds-dashboard` so `--dogshift-blue` resolves to the dashboard PURPLE
// (#7c3aed) inside the overlay — otherwise, rendered outside the shell, the icon
// falls back to the navy default (#7c3aed) and flips purple only when the real
// page mounts (founder: "icône grise puis violette").
const OVERLAY_CLASS = "fixed inset-0 z-40 w-full overflow-y-auto bg-white px-3";

function CardRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
      <div className="ds-skel h-12 w-12 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="ds-skel h-4 w-2/3 rounded-lg" />
        <div className="ds-skel h-3 w-2/5 rounded-lg" />
        <div className="ds-skel h-5 w-24 rounded-full" />
      </div>
    </div>
  );
}

/** Replica of RequestsSplitView's native loading view (Réservations). */
export function RequestsRouteSkeleton() {
  return (
    // Fixed overlay (covers the transition gap); padding mirrors the shell EXACTLY
    // so the header sits at the identical spot before/after load. data-ds-dashboard
    // → the icon is dashboard-purple, not navy.
    <div data-ds-dashboard className={OVERLAY_CLASS} style={{ paddingTop: ROOT_PT }}>
      {/* shell inner <div w-full pt-1 pb-3> */}
      <div className="w-full pt-1 pb-3">
        {/* RequestsSplitView outer <div w-full px-1 pb-12> */}
        <div className="w-full px-1 pb-12">
          <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
            <section className="min-w-0">
              {/* Header (native: no card, px-1) */}
              <div className="px-1">
                <h1 className="flex items-center gap-2 whitespace-nowrap text-[22px] font-extrabold tracking-tight text-slate-900">
                  <ClipboardList className="h-6 w-6 shrink-0 text-[var(--dogshift-blue)]" aria-hidden="true" />
                  <span>Demandes de réservations</span>
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">0</span> en attente
                </p>

                <div className="mt-6">
                  <div className="inline-flex rounded-2xl border border-slate-100 bg-slate-50/50 p-1 shadow-inner">
                    <span className="h-9 rounded-xl px-4 text-sm font-bold leading-9 bg-white text-[var(--dogshift-blue)] shadow-sm ring-1 ring-slate-200/50">
                      Réservations
                    </span>
                    <span className="h-9 rounded-xl px-4 text-sm font-bold leading-9 text-slate-500">Archivées</span>
                  </div>
                </div>

                {/* Use the REAL (non-interactive) <select>/<input> with the exact
                    same classes as RequestsSplitView, not <div>s mimicking them.
                    A <div> and a form control render text at different sizes under
                    the native 16px no-zoom rule + WebKit autosizing, so a div
                    placeholder still "grew" on the skeleton→page hand-off. Same
                    element = pixel-identical = zero jump. */}
                <div className="mt-6 grid gap-3 md:grid-cols-[140px_1fr]">
                  <div className="relative">
                    <select
                      aria-hidden="true"
                      tabIndex={-1}
                      className="pointer-events-none h-10 w-full md:w-[140px] appearance-none rounded-2xl border border-slate-100 bg-white pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-sm outline-none"
                    >
                      <option>Tous</option>
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.5 3a5.5 5.5 0 104.384 8.824l2.146 2.146a.75.75 0 101.06-1.06l-2.146-2.146A5.5 5.5 0 008.5 3zm-4 5.5a4 4 0 117.999.001A4 4 0 014.5 8.5z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <input
                      aria-hidden="true"
                      tabIndex={-1}
                      readOnly
                      placeholder="Rechercher…"
                      className="pointer-events-none h-10 w-full appearance-none rounded-2xl border border-slate-100 bg-white pl-10 pr-3 text-sm font-medium text-slate-900 shadow-sm outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Skeleton list — identical to the page's own loading list (3 rows) */}
              <div className="mt-4 space-y-3">
                {[0, 1, 2].map((i) => (
                  <CardRow key={i} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Replica of the host messages layout's native loading view (Conversations). */
export function MessagesRouteSkeleton() {
  return (
    // Fixed overlay; padding mirrors the shell EXACTLY so nothing jumps on load.
    <div data-ds-dashboard className={OVERLAY_CLASS} style={{ paddingTop: ROOT_PT }}>
      {/* shell inner <div w-full pt-1 pb-3> */}
      <div className="w-full pt-1 pb-3">
        {/* HostMessagesLayout root (mobile: -mx-4 -mt-4 bg-white) */}
        <div className="-mx-4 -mt-4 bg-white">
          {/* aside p-4 */}
          <div className="p-4">
            <h1 className="mb-3 text-[26px] font-extrabold tracking-tight text-slate-900">Conversations</h1>
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
                  <div className="ds-skel h-12 w-12 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="ds-skel h-4 w-1/2 rounded-lg" />
                    <div className="ds-skel h-3 w-3/4 rounded-lg" />
                    <div className="ds-skel h-3 w-1/4 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* The "+" FAB lives in the messages LAYOUT, which suspends during the
          force-dynamic load — so it only appeared AFTER the skeleton. Render a
          static replica (same position/style) inside the skeleton so it shows
          at the same time as the loading state (founder request). */}
      <div
        aria-hidden="true"
        style={{ bottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 16px)" }}
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-[0_10px_30px_-6px_rgba(124,58,237,0.65)] lg:hidden"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </div>
    </div>
  );
}
