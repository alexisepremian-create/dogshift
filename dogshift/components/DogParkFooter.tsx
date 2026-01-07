import React from "react";

export default function DogParkFooter() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)]">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(1200px 520px at 50% 120%, rgba(16,185,129,0.55) 0%, rgba(16,185,129,0.20) 30%, rgba(255,255,255,0) 62%), radial-gradient(900px 420px at 8% 110%, rgba(34,197,94,0.42) 0%, rgba(34,197,94,0.18) 26%, rgba(255,255,255,0) 58%), radial-gradient(900px 420px at 92% 110%, rgba(34,197,94,0.42) 0%, rgba(34,197,94,0.18) 26%, rgba(255,255,255,0) 58%), linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(16,185,129,0.22) 100%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[88px]"
        aria-hidden="true"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgba(16,185,129,0.0) 0px, rgba(16,185,129,0.0) 18px, rgba(16,185,129,0.28) 18px, rgba(16,185,129,0.28) 20px)",
          maskImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.0) 92%)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.0) 92%)",
        }}
      />

      <div className="relative px-6 py-7 sm:px-8 sm:py-8">
        <div className="grid gap-2">
          <p className="text-xs font-semibold text-emerald-800">Parc à chien</p>
          <p className="text-lg font-semibold tracking-tight text-emerald-950">Un coin de verdure, même dans ton espace.</p>
          <p className="max-w-2xl text-sm leading-relaxed text-emerald-900/80">
            Promenades, jeux, nature — une touche DogShift pour respirer entre deux réservations.
          </p>
        </div>
      </div>
    </section>
  );
}
