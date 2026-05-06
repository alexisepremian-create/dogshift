/**
 * Shown by Next.js during admin page navigation (Suspense boundary).
 * Mimics the AdminShell layout so the sidebar stays visible while
 * the content area streams in.
 */
export default function AdminLoading() {
  return (
    <div className="flex min-h-screen bg-[#f7f8fc]">
      {/* Sidebar skeleton */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
        {/* Logo */}
        <div className="mb-6 h-8 w-28 animate-pulse rounded-xl bg-slate-200" />

        {/* Nav items */}
        <nav className="flex flex-col gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded-2xl bg-slate-100"
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </nav>

        {/* Logout */}
        <div className="mt-auto h-9 animate-pulse rounded-2xl bg-slate-100" />
      </aside>

      {/* Content area skeleton */}
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-8">
        {/* Page title */}
        <div className="mb-6 h-7 w-48 animate-pulse rounded-xl bg-slate-200" />

        {/* Card rows */}
        <div className="space-y-5">
          <div className="h-32 animate-pulse rounded-3xl bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.10)] border border-slate-200" />
          <div className="h-48 animate-pulse rounded-3xl bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.10)] border border-slate-200" />

          {/* Two-column list skeleton */}
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <div className="space-y-2">
              <div className="h-11 animate-pulse rounded-2xl bg-white border border-slate-200" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-white border border-slate-200" />
              ))}
            </div>
            <div className="h-80 animate-pulse rounded-3xl bg-white border border-slate-200" />
          </div>
        </div>
      </main>
    </div>
  );
}
