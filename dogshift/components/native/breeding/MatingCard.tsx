"use client";
/* eslint-disable @next/next/no-img-element */

import { MapPin, Dog } from "lucide-react";

import { MATING_GOAL_LABELS, qualzuchtNotice } from "@/lib/breeding/legalCopy";
import { ageLabel, type DeckCard } from "./types";

/** A single swipe card (photo-first, à la Tinder). Purely presentational. */
export default function MatingCard({ card }: { card: DeckCard }) {
  const age = ageLabel(card.birthYear);
  const notice = qualzuchtNotice(card.breed);
  const sexLabel = card.sex === "MALE" ? "Mâle" : card.sex === "FEMALE" ? "Femelle" : null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-slate-100 shadow-[0_20px_50px_rgba(2,6,23,0.25)]">
      {card.photoUrl ? (
        <img src={card.photoUrl} alt={card.dogName} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#7c3aed]/25 to-slate-200">
          <Dog className="h-24 w-24 text-white/80" />
        </div>
      )}

      {/* Bottom gradient + info */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-5 pb-6 pt-20 text-white">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-2xl font-bold tracking-tight">
            {card.dogName}
            {age ? <span className="ml-2 text-lg font-semibold opacity-90">{age}</span> : null}
          </h2>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
          {card.breed ? <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">{card.breed}</span> : null}
          {sexLabel ? <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">{sexLabel}</span> : null}
          {card.region ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
              <MapPin className="h-3 w-3" /> {card.region}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[13px] font-semibold text-[#e9d5ff]">{MATING_GOAL_LABELS[card.goal]}</p>
        {card.bio ? <p className="mt-1 line-clamp-2 text-sm text-white/85">{card.bio}</p> : null}
        {notice ? <p className="mt-2 rounded-xl bg-amber-500/25 px-3 py-1.5 text-[11px] leading-snug text-amber-50">{notice}</p> : null}
      </div>
    </div>
  );
}
