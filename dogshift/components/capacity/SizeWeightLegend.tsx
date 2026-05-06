"use client";

import { Dog } from "lucide-react";
import { DOG_SIZE_KEYS, DOG_SIZE_WEIGHTS, type DogSizeKey } from "@/lib/constants/dog-sizes";

const sizeClasses: Record<DogSizeKey, string> = {
  small: "h-4 w-4",
  medium: "h-5 w-5",
  large: "h-6 w-6",
};

export function SizeWeightLegend({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className ?? ""}`}>
      {DOG_SIZE_KEYS.map((key) => {
        const { label, weight } = DOG_SIZE_WEIGHTS[key];
        return (
          <span key={key} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <Dog className={`${sizeClasses[key]} text-slate-400`} />
            <span className="font-medium text-slate-700">{label}</span>
            <span className="text-slate-400">=</span>
            <span className="font-semibold text-slate-800">
              {weight} {weight === 1 ? "place" : "places"}
            </span>
          </span>
        );
      })}
    </div>
  );
}
