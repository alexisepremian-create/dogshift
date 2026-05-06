/**
 * Content-area skeleton for owner account pages.
 * Renders within OwnerDashboardShell — the sidebar/header/bottom-nav
 * are already present from the layout. This only fills the content area.
 */
export default function AccountPageSkeleton() {
  return (
    <div className="animate-pulse space-y-5 py-2">
      {/* Page title */}
      <div className="h-7 w-44 rounded-xl bg-slate-100" />

      {/* Tab bar */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-slate-100" />
        ))}
      </div>

      {/* Card rows */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded-lg bg-slate-100" />
              <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
              <div className="h-5 w-20 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
