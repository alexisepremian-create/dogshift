"use client";

import { X } from "lucide-react";

import type { DeckFilterState } from "./SwipeDeck";

const SIZES: { key: "small" | "medium" | "large"; label: string }[] = [
  { key: "small", label: "Petit" },
  { key: "medium", label: "Moyen" },
  { key: "large", label: "Grand" },
];

const RADII: { value: number | null; label: string }[] = [
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
  { value: 50, label: "50 km" },
  { value: 100, label: "100 km" },
  { value: null, label: "Partout" },
];

/** Bottom-sheet filters for the swipe deck. */
export default function DeckFilters({
  value,
  onChange,
  onClose,
}: {
  value: DeckFilterState;
  onChange: (next: DeckFilterState) => void;
  onClose: () => void;
}) {
  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
      active ? "bg-[#7c3aed] text-white" : "bg-slate-100 text-slate-700"
    }`;

  return (
    <>
      <div className="fixed inset-0 z-[1200] bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed inset-x-0 bottom-0 z-[1201] rounded-t-3xl bg-white px-5 pb-8 pt-3 shadow-[0_-16px_40px_rgba(2,6,23,0.22)]"
        role="dialog"
        aria-modal="true"
        aria-label="Filtres"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Filtres</h3>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-900">Race</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className={chip(value.breedMode === "any")} onClick={() => onChange({ ...value, breedMode: "any" })}>
            Toutes les races
          </button>
          <button type="button" className={chip(value.breedMode === "same")} onClick={() => onChange({ ...value, breedMode: "same" })}>
            Même race
          </button>
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-900">Taille</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={chip(value.size === null)} onClick={() => onChange({ ...value, size: null })}>
            Toutes
          </button>
          {SIZES.map((s) => (
            <button key={s.key} type="button" className={chip(value.size === s.key)} onClick={() => onChange({ ...value, size: s.key })}>
              {s.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-900">Distance</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {RADII.map((r) => (
            <button key={r.label} type="button" className={chip(value.radiusKm === r.value)} onClick={() => onChange({ ...value, radiusKm: r.value })}>
              {r.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-[#7c3aed] py-3 text-base font-semibold text-white active:scale-[0.98]"
        >
          Voir les chiens
        </button>
      </div>
    </>
  );
}
