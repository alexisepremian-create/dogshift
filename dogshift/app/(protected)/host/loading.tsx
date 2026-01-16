export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="space-y-4">
        <div className="h-7 w-48 rounded bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-24 rounded-3xl border border-slate-200 bg-white" />
          <div className="h-24 rounded-3xl border border-slate-200 bg-white" />
          <div className="h-24 rounded-3xl border border-slate-200 bg-white" />
          <div className="h-24 rounded-3xl border border-slate-200 bg-white" />
        </div>
        <div className="h-64 rounded-3xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
