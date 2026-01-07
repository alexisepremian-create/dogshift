export default function AccountDashboardLoading() {
  const stat = "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8";
  const shimmer = "animate-pulse";
  const line = "h-3 rounded bg-slate-100";

  return (
    <div className="grid gap-6" aria-busy="true" aria-live="polite">
      <div className={shimmer}>
        <div className="h-4 w-28 rounded bg-slate-100" />
        <div className="mt-3 h-8 w-64 rounded bg-slate-100" />
        <div className="mt-3 h-4 w-80 rounded bg-slate-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className={`${stat} ${shimmer}`}>
            <div className="flex items-center justify-between">
              <div className="h-4 w-36 rounded bg-slate-100" />
              <div className="h-5 w-5 rounded bg-slate-100" />
            </div>
            <div className="mt-4 h-10 w-16 rounded bg-slate-100" />
            <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${stat} ${shimmer} lg:col-span-2`}>
          <div className="h-5 w-44 rounded bg-slate-100" />
          <div className="mt-3 h-4 w-64 rounded bg-slate-100" />
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="h-4 w-40 rounded bg-slate-100" />
            <div className="mt-3 grid gap-2">
              <div className={line} />
              <div className={line} />
            </div>
            <div className="mt-4 h-10 w-28 rounded bg-slate-100" />
          </div>
        </div>

        <div className={`${stat} ${shimmer}`}>
          <div className="h-5 w-32 rounded bg-slate-100" />
          <div className="mt-3 h-4 w-40 rounded bg-slate-100" />
          <div className="mt-5 grid gap-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <div className="h-4 w-32 rounded bg-slate-100" />
                <div className="h-4 w-6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
