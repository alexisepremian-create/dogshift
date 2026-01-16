"use client";

import Spinner from "@/components/ui/Spinner";

export default function PageLoader({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex w-full items-center justify-center" style={{ minHeight: "100dvh" }} aria-busy="true" aria-live="polite">
      <div className="flex w-[240px] flex-col items-center justify-center text-center">
        <Spinner className="h-12 w-12 animate-spin motion-reduce:animate-none text-slate-700" />
        <p className="mt-4 h-5 text-sm font-medium leading-5 text-slate-700">{label}</p>
      </div>
    </div>
  );
}
