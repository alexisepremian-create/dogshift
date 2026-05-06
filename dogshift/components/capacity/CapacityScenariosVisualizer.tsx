"use client";

import { Dog } from "lucide-react";
import {
  DOG_SIZE_KEYS,
  DOG_SIZE_WEIGHTS,
  generateCapacityScenarios,
  type DogSizeKey,
} from "@/lib/constants/dog-sizes";

const iconClasses: Record<DogSizeKey, string> = {
  small: "h-3.5 w-3.5",
  medium: "h-4.5 w-4.5",
  large: "h-5.5 w-5.5",
};

const colorClasses: Record<DogSizeKey, string> = {
  small: "text-cyan-500",
  medium: "text-violet-500",
  large: "text-emerald-600",
};

interface CapacityScenariosVisualizerProps {
  capacity: number;
  accepted: Record<DogSizeKey, boolean>;
}

export function CapacityScenariosVisualizer({
  capacity,
  accepted,
}: CapacityScenariosVisualizerProps) {
  const enabledSizes = DOG_SIZE_KEYS.filter((k) => accepted[k]);
  const scenarios = generateCapacityScenarios(capacity, enabledSizes, 5);

  if (scenarios.length === 0) {
    return (
      <p className="text-center text-sm text-slate-400 italic">
        Active au moins une taille pour voir les combinaisons possibles.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        Avec <span className="font-bold text-slate-800">{capacity} places</span>, tu peux
        accueillir par exemple :
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {scenarios.map((combo, i) => {
          const parts = DOG_SIZE_KEYS.filter((k) => combo[k] > 0);
          const totalUsed = parts.reduce(
            (sum, k) => sum + combo[k] * DOG_SIZE_WEIGHTS[k].weight,
            0,
          );

          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
            >
              {/* Dog icons */}
              <div className="flex items-end gap-0.5">
                {parts.flatMap((size) =>
                  Array.from({ length: combo[size] }, (_, j) => (
                    <Dog
                      key={`${size}-${j}`}
                      className={`${iconClasses[size]} ${colorClasses[size]}`}
                    />
                  )),
                )}
              </div>

              {/* Text label */}
              <span className="text-xs text-slate-600">
                {parts
                  .map((k) => `${combo[k]} ${DOG_SIZE_WEIGHTS[k].label.toLowerCase()}${combo[k] > 1 ? "s" : ""}`)
                  .join(" + ")}
              </span>

              {/* Places used badge */}
              <span className="ml-auto shrink-0 rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {totalUsed}/{capacity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
