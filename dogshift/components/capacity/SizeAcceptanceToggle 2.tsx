"use client";

import { Dog } from "lucide-react";
import { DOG_SIZE_KEYS, DOG_SIZE_WEIGHTS, type DogSizeKey } from "@/lib/constants/dog-sizes";

const sizeIconClasses: Record<DogSizeKey, string> = {
  small: "h-6 w-6",
  medium: "h-7 w-7",
  large: "h-8 w-8",
};

interface SizeAcceptanceToggleProps {
  accepted: Record<DogSizeKey, boolean>;
  onChange: (next: Record<DogSizeKey, boolean>) => void;
}

export function SizeAcceptanceToggle({ accepted, onChange }: SizeAcceptanceToggleProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {DOG_SIZE_KEYS.map((key) => {
        const { label, range, weight } = DOG_SIZE_WEIGHTS[key];
        const active = accepted[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ ...accepted, [key]: !active })}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5 transition-all ${
              active
                ? "border-[var(--dogshift-blue)] bg-[var(--dogshift-blue)]/5 shadow-sm"
                : "border-slate-200 bg-slate-50 opacity-60"
            }`}
          >
            <Dog
              className={`${sizeIconClasses[key]} ${
                active ? "text-[var(--dogshift-blue)]" : "text-slate-400"
              }`}
            />
            <span
              className={`text-sm font-bold ${
                active ? "text-slate-900" : "text-slate-400 line-through"
              }`}
            >
              {label}
            </span>
            <span className="text-xs text-slate-500">{range}</span>
            <span
              className={`mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                active
                  ? "bg-[var(--dogshift-blue)]/10 text-[var(--dogshift-blue)]"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              = {weight} {weight === 1 ? "place" : "places"}
            </span>

            {/* Toggle indicator */}
            <div
              className={`mt-2 flex h-6 w-11 items-center rounded-full p-0.5 transition ${
                active ? "bg-[var(--dogshift-blue)]" : "bg-slate-300"
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  active ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
