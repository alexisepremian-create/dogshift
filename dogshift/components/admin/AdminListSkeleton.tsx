"use client";

/**
 * Skeleton placeholder for admin list panels while data is fetching.
 * Mimics the two-column layout (list sidebar + detail panel) used in
 * AdminActiveSittersClient, AdminSitterApplicationsClient, etc.
 */
export default function AdminListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mt-6 animate-pulse grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Left list column */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        {/* Search bar */}
        <div className="h-11 w-full rounded-2xl bg-slate-200" />

        {/* List rows */}
        <div className="mt-3 grid gap-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/4 rounded-lg bg-slate-200" />
                <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
              </div>
              <div className="h-5 w-16 shrink-0 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Right detail panel */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-5 w-48 rounded-lg bg-slate-200" />
          <div className="h-3.5 w-32 rounded-lg bg-slate-100" />
        </div>
        {/* Content blocks */}
        <div className="h-24 rounded-2xl bg-slate-200" />
        <div className="h-16 rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 rounded-2xl bg-slate-200" />
          <div className="h-12 rounded-2xl bg-slate-200" />
          <div className="h-12 rounded-2xl bg-slate-200" />
          <div className="h-12 rounded-2xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

/**
 * Simpler skeleton for single-column admin lists (notes, costs, etc.)
 */
export function AdminSimpleListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-5 animate-pulse grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <div className="h-3.5 w-5/6 rounded-lg bg-slate-200" />
          <div className="h-3 w-2/3 rounded-lg bg-slate-100" />
          <div className="h-3 w-1/3 rounded-lg bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
