"use client";

import { ClipboardList } from "lucide-react";

/**
 * Route-level loading skeletons that FAITHFULLY replicate each section page's
 * own loading view — INCLUDING the exact shell + page nesting/padding, so the
 * skeleton content sits at the PIXEL-IDENTICAL position as the real page.
 *
 * Why the nesting matters: the dashboard pages render deep inside the shell:
 *   HostDashboardShell <main px-3 pt-[safe+banner+2rem]>
 *     <div w-full py-3>                       ← +12px top
 *       RequestsSplitView <div w-full px-1 pb-12>
 *         <div grid> <section> <div px-1>      ← header
 * These route fallbacks render OUTSIDE the shell, so they must reproduce that
 * exact chain. Earlier the fallback used only `px-3 pt-2rem`, so when it handed
 * off to the real page the content jumped ~12px down + ~4px right — that jump
 * was the "flash" the founder kept seeing on every navigation. With the nesting
 * matched (and the white body from #483), the route→page hand-off is invisible.
 *
 * `--ds-maintenance-banner-height` is included to match the shell exactly.
 */

const ROOT_PT = "calc(env(safe-area-inset-top, 0px) + var(--ds-maintenance-banner-height, 0px) + 2rem)";
const ROOT_PB = "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 24px)";

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
    // shell <main px-3 pt-…>
    <div className="min-h-screen w-full bg-white px-3" style={{ paddingTop: ROOT_PT, paddingBottom: ROOT_PB }}>
      {/* shell inner <div w-full py-3> */}
      <div className="w-full py-3">
        {/* RequestsSplitView outer <div w-full px-1 pb-12> */}
        <div className="w-full px-1 pb-12">
          <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
            <section className="min-w-0">
              {/* Header (native: no card, px-1) */}
              <div className="px-1">
                <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-slate-900">
                  <ClipboardList className="h-6 w-6 text-[var(--dogshift-blue)]" aria-hidden="true" />
                  <span>Réservations</span>
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

                <div className="mt-6 grid gap-3 md:grid-cols-[140px_1fr]">
                  <div className="relative">
                    <div className="flex h-10 w-full items-center rounded-2xl border border-slate-100 bg-white pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-sm md:w-[140px]">
                      Tous
                    </div>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.5 3a5.5 5.5 0 104.384 8.824l2.146 2.146a.75.75 0 101.06-1.06l-2.146-2.146A5.5 5.5 0 008.5 3zm-4 5.5a4 4 0 117.999.001A4 4 0 014.5 8.5z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <div className="flex h-10 w-full items-center rounded-2xl border border-slate-100 bg-white pl-10 pr-3 text-sm text-slate-400 shadow-sm">
                      Rechercher…
                    </div>
                  </div>
                </div>
              </div>

              {/* Skeleton list — sibling of the header, exactly like the page */}
              <div className="mt-4 space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
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
    // shell <main px-3 pt-…>
    <div className="min-h-screen w-full bg-white px-3" style={{ paddingTop: ROOT_PT, paddingBottom: ROOT_PB }}>
      {/* shell inner <div w-full py-3> */}
      <div className="w-full py-3">
        {/* HostMessagesLayout root (mobile: -mx-4 -mt-4 bg-white) */}
        <div className="-mx-4 -mt-4 bg-white">
          {/* aside p-4 */}
          <div className="p-4">
            <h1 className="mb-3 text-[26px] font-extrabold tracking-tight text-slate-900">Conversations</h1>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
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
    </div>
  );
}
