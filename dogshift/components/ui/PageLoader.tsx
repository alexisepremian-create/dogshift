"use client";

import Spinner from "@/components/ui/Spinner";

export default function PageLoader({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-6 py-12" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <Spinner className="h-5 w-5 animate-spin text-slate-600" />
        <p className="text-sm font-medium text-slate-700">{label}</p>
      </div>
    </div>
  );
}
