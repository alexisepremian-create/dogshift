"use client";

import dynamic from "next/dynamic";
import { Expand } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

const MapboxMap = dynamic<{
  variant: "preview" | "expanded";
  theme?: "light" | "dark";
  serviceFilter?: string;
  locationFilter?: string;
}>(
  () => import("@/components/MapboxMap"),
  {
  ssr: false,
  }
);

export default function MapPreview({
  embedded = false,
  previewHeightClass = "h-[220px] w-full sm:h-[260px]",
}: {
  embedded?: boolean;
  previewHeightClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const serviceOptions = useMemo(() => ["Tous", "Promenade", "Garde", "Pension"], []);
  const [service, setService] = useState<(typeof serviceOptions)[number]>(serviceOptions[0]);
  const [location, setLocation] = useState<string>("");

  const modal = open ? (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 pointer-events-none" role="dialog" aria-modal="true" aria-label="Carte">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] pointer-events-none" aria-hidden="true" />

      <div className="pointer-events-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_22px_80px_-54px_rgba(2,6,23,0.6)]">
        <div className="relative z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">Carte des sitters</p>
            <div className="group relative">
              <button
                type="button"
                aria-label="Informations sur la carte"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-xs font-bold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                i
              </button>

              <div className="pointer-events-none absolute left-0 top-8 z-40 w-[300px] rounded-2xl border border-slate-200 bg-white/55 p-3 text-xs text-slate-700 opacity-0 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.45)] backdrop-blur-md transition duration-150 ease-out translate-y-1 group-hover:translate-y-0 group-focus-within:translate-y-0 group-hover:opacity-100 group-focus-within:opacity-100">
                <p className="font-semibold text-slate-900">À quoi sert la carte ?</p>
                <p className="mt-1 leading-relaxed text-slate-600">
                  Visualisez les dogsitters autour de vous, puis affinez avec les filtres (service + lieu). Cliquez sur un
                  pin pour voir un aperçu et accéder au profil.
                </p>
                <p className="mt-2 leading-relaxed text-slate-500">Fond de carte: MapTiler • Données: OpenStreetMap.</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>

        <div className="relative h-[80vh] w-full bg-slate-50">
          <div className="pointer-events-auto absolute bottom-16 right-4 z-30 w-[220px] rounded-2xl border border-slate-200 bg-white/92 p-3 shadow-sm backdrop-blur sm:w-[240px]">
            <div className="grid gap-2">
              <div>
                <label htmlFor="map-service" className="block text-[11px] font-semibold text-slate-700">
                  Service
                </label>
                <select
                  id="map-service"
                  value={service}
                  onChange={(e) => setService(e.target.value as (typeof serviceOptions)[number])}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                >
                  {serviceOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="map-location" className="block text-[11px] font-semibold text-slate-700">
                  Lieu
                </label>
                <input
                  id="map-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="ex. Genève"
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                  autoComplete="off"
                  inputMode="text"
                />
              </div>
            </div>
          </div>

          <MapboxMap variant="expanded" theme="light" serviceFilter={service === "Tous" ? "" : service} locationFilter={location} />
        </div>
      </div>
    </div>
  ) : null;

  const card = (
    <div className={embedded ? "w-full" : "mx-auto max-w-4xl"}>
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-44px_rgba(2,6,23,0.35)]">
        {!open ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-14"
            style={{
              background:
                "linear-gradient(180deg, rgba(248,250,252,0.92) 0%, rgba(248,250,252,0.68) 38%, rgba(248,250,252,0.22) 72%, rgba(248,250,252,0) 100%)",
            }}
          />
        ) : null}

        {!open ? (
          <div className="pointer-events-auto absolute right-3 top-3 z-40 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-white/80 shadow-[0_10px_30px_-18px_rgba(2,6,23,0.35)] ring-1 ring-white/60 backdrop-blur transition hover:bg-white"
              aria-label="Agrandir la carte"
            >
              <Expand className="h-[18px] w-[18px] text-slate-700" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className={`relative z-0 ${previewHeightClass}`}>
          <MapboxMap variant="preview" theme="light" />
        </div>

        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-slate-200/60" />
      </div>
    </div>
  );

  return (
    <section className={embedded ? undefined : "pt-px pb-14 sm:pb-16"}>
      {embedded ? (
        card
      ) : (
        <div className="mx-auto max-w-6xl px-4 sm:px-6">{card}</div>
      )}

      {typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
    </section>
  );
}
