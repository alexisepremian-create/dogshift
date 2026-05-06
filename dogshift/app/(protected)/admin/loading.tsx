import AdminShell from "@/components/admin/AdminShell";

/**
 * Shown by Next.js while admin page content is loading.
 * Renders the real AdminShell so the sidebar stays visible —
 * only the content area shows the skeleton.
 */
export default function AdminLoading() {
  return (
    <AdminShell>
      <div className="animate-pulse space-y-5">
        {/* Page title */}
        <div className="h-7 w-48 rounded-xl bg-slate-200" />

        {/* Top card */}
        <div className="h-28 rounded-3xl border border-slate-200 bg-white" />

        {/* Two-column layout */}
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* Left list */}
          <div className="space-y-2">
            <div className="h-11 rounded-2xl border border-slate-200 bg-white" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-14 rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
          {/* Right detail panel */}
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
            <div className="h-5 w-44 rounded-lg bg-slate-200" />
            <div className="h-20 rounded-2xl bg-slate-100" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-11 rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
