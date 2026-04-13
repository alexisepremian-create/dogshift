"use client";

/**
 * Lightweight skeleton placeholder for dashboard pages on mobile.
 * Shows shimmer blocks that mimic a typical dashboard layout
 * without covering the bottom nav or top header.
 */
export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5 px-1 py-2">
      {/* Title bar skeleton */}
      <div className="h-7 w-40 rounded-xl bg-slate-100" />

      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-slate-100" />
        <div className="h-24 rounded-2xl bg-slate-100" />
      </div>

      {/* Wide card */}
      <div className="h-32 rounded-2xl bg-slate-100" />

      {/* List items */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded-lg bg-slate-100" />
              <div className="h-3 w-1/2 rounded-lg bg-slate-50" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom card */}
      <div className="h-20 rounded-2xl bg-slate-100" />
    </div>
  );
}
