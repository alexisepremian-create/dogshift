"use client";

import { Dog } from "lucide-react";
import { DOG_SIZE_KEYS, DOG_SIZE_WEIGHTS, type DogSizeKey } from "@/lib/constants/dog-sizes";

const sizeIconClasses: Record<DogSizeKey, string> = {
  small: "h-5 w-5 sm:h-6 sm:w-6",
  medium: "h-6 w-6 sm:h-7 sm:w-7",
  large: "h-7 w-7 sm:h-8 sm:w-8",
};

interface SizeAcceptanceToggleProps {
  accepted: Record<DogSizeKey, boolean>;
  onChange: (next: Record<DogSizeKey, boolean>) => void;
  /** When set, sizes where the value is true are locked (disabled by admin restriction). */
  disabledSizes?: Partial<Record<DogSizeKey, boolean>>;
}

export function SizeAcceptanceToggle({ accepted, onChange, disabledSizes }: SizeAcceptanceToggleProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {DOG_SIZE_KEYS.map((key) => {
        const { label, range, weight } = DOG_SIZE_WEIGHTS[key];
        const active = accepted[key];
        const locked = Boolean(disabledSizes?.[key]);
        return (
          <button
            key={key}
            type="button"
            disabled={locked}
            onClick={() => !locked && onChange({ ...accepted, [key]: !active })}
            title={locked ? "Non autorisé suite à la vérification de votre logement" : undefined}
            className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 transition-all sm:gap-2 sm:px-4 sm:py-5 ${
              locked
                ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-50"
                : active
                  ? "border-[var(--dogshift-blue)] bg-[var(--dogshift-blue)]/5 shadow-sm"
                  : "border-slate-200 bg-slate-50 opacity-60"
            }`}
          >
            <Dog
              className={`${sizeIconClasses[key]} ${
                locked ? "text-slate-300" : active ? "text-[var(--dogshift-blue)]" : "text-slate-400"
              }`}
            />
            <span
              className={`text-xs font-bold sm:text-sm ${
                locked ? "text-slate-300" : active ? "text-slate-900" : "text-slate-400 line-through"
              }`}
            >
              {label}
            </span>
            <span className="text-[10px] text-slate-400 sm:text-xs">{range}</span>
            <span
              className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:mt-1 sm:px-2.5 sm:text-[11px] ${
                locked
                  ? "bg-slate-100 text-slate-300"
                  : active
                    ? "bg-[var(--dogshift-blue)]/10 text-[var(--dogshift-blue)]"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              = {weight} {weight === 1 ? "place" : "places"}
            </span>

            {locked ? (
              <div className="mt-1 flex items-center gap-1 rounded-full bg-slate-200 px-1.5 py-0.5 sm:mt-2 sm:px-2.5">
                <svg className="h-3 w-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span className="text-[9px] font-semibold text-slate-400 sm:text-[10px]">Restreint</span>
              </div>
            ) : (
              <div
                className={`mt-1 flex h-5 w-9 items-center rounded-full p-0.5 transition sm:mt-2 sm:h-6 sm:w-11 ${
                  active ? "bg-[var(--dogshift-blue)]" : "bg-slate-300"
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform sm:h-5 sm:w-5 ${
                    active ? "translate-x-4 sm:translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
