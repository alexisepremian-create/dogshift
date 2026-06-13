"use client";

/**
 * Universal native loading skeleton — purple neon "glide" shimmer (.ds-skel).
 *
 * Shape: a left-aligned title, a row of filter chips, then a list of card rows
 * (avatar + two text lines). This intentionally matches the real shape of the
 * sections it stands in for — Réservations (title + filter pills + request
 * cards) and Conversations (title + conversation rows) — so the hand-off from
 * this route-level fallback to each page's own client-fetch skeleton reads as
 * ONE continuous load instead of two mismatched flashes.
 *
 * Rendered IN-FLOW (never a fixed full-screen overlay) so the bottom nav stays
 * visible during loading.
 */
export default function DashboardSkeleton() {
  return (
    <div className="w-full">
      {/* Title */}
      <div className="ds-skel h-8 w-48 rounded-2xl" />

      {/* Filter chips */}
      <div className="mt-5 flex gap-2">
        <div className="ds-skel h-9 w-28 rounded-full" />
        <div className="ds-skel h-9 w-24 rounded-full" />
        <div className="ds-skel h-9 w-20 rounded-full" />
      </div>

      {/* Card rows */}
      <div className="mt-5 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white p-3"
          >
            <div className="ds-skel h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="ds-skel h-4 w-2/3 rounded-lg" />
              <div className="ds-skel h-3 w-2/5 rounded-lg" />
              <div className="ds-skel h-5 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
