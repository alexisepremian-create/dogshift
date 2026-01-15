"use client";

import Spinner from "@/components/ui/Spinner";

export default function PageLoader({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-6 py-12" aria-busy="true" aria-live="polite">
      <div className="flex flex-col items-center justify-center">
        <Spinner className="h-12 w-12 animate-spin motion-reduce:animate-none text-slate-700" />
        <p className="mt-4 text-sm font-medium text-slate-700">{label}</p>
      </div>
    </div>
  );
}
