"use client";

import { Minus, Plus } from "lucide-react";
import { MAX_CAPACITY_PLACES } from "@/lib/constants/dog-sizes";

interface CapacitySliderProps {
  value: number;
  onChange: (next: number) => void;
}

export function CapacitySlider({ value, onChange }: CapacitySliderProps) {
  const clamp = (n: number) => Math.min(MAX_CAPACITY_PLACES, Math.max(1, n));

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Big value display */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-5xl font-extrabold tracking-tight text-slate-900">{value}</span>
        <span className="text-lg font-medium text-slate-500">
          {value === 1 ? "place" : "places"}
        </span>
      </div>

      {/* +/- buttons + slider */}
      <div className="flex w-full max-w-xs items-center gap-3">
        <button
          type="button"
          aria-label="Diminuer"
          disabled={value <= 1}
          onClick={() => onChange(clamp(value - 1))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={1}
          max={MAX_CAPACITY_PLACES}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[var(--dogshift-blue)] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--dogshift-blue)] [&::-webkit-slider-thumb]:shadow-md"
        />
        <button
          type="button"
          aria-label="Augmenter"
          disabled={value >= MAX_CAPACITY_PLACES}
          onClick={() => onChange(clamp(value + 1))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Scale labels */}
      <div className="flex w-full max-w-xs justify-between px-[52px] text-[10px] font-medium text-slate-400">
        <span>1</span>
        <span>{MAX_CAPACITY_PLACES}</span>
      </div>
    </div>
  );
}
