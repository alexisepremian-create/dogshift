"use client";

import type { ReactNode } from "react";
import { Heart } from "lucide-react";

/**
 * Decorative "two crossing swipe cards + heart" — a mini visual of what the
 * Rencontres feature is (founder: "un mini schéma avec deux cartes qui se
 * croisent en arrière plan, c'est plus intuitif").
 */
export function CrossingCards() {
  return (
    <div className="pointer-events-none relative h-32 w-44" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 h-28 w-20 -translate-x-1/2 -translate-y-1/2 -rotate-[15deg] rounded-2xl border-2 border-[#7c3aed]/25 bg-[#7c3aed]/5" />
      <div className="absolute left-1/2 top-1/2 h-28 w-20 -translate-x-1/2 -translate-y-1/2 rotate-[15deg] rounded-2xl border-2 border-[#7c3aed]/40 bg-white shadow-[0_8px_20px_rgba(124,58,237,0.15)]" />
      <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#7c3aed] shadow-lg">
        <Heart className="h-4 w-4 fill-white text-white" />
      </div>
    </div>
  );
}

/**
 * Shared empty-state for the breeding tabs. A FIXED-height visual slot keeps the
 * title/subtitle/action at exactly the same height across every tab (founder:
 * "tout à la même hauteur"), whether the visual is a plain icon or the crossing
 * cards illustration.
 */
export default function BreedingEmptyState({
  icon,
  illustration,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode;
  illustration?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center px-8 pt-[18vh] text-center">
      <div className="flex h-32 items-center justify-center">
        {illustration ?? (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed]/10">{icon}</div>
        )}
      </div>
      <p className="mt-1 text-lg font-bold text-slate-900">{title}</p>
      {subtitle ? <p className="mt-2 max-w-[300px] text-sm text-slate-500">{subtitle}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
