"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, X, SlidersHorizontal, RefreshCw, PawPrint } from "lucide-react";

import MatingCard from "./MatingCard";
import BreedingEmptyState from "./BreedingEmptyState";
import type { DeckCard } from "./types";

export type DeckFilterState = {
  breedMode: "same" | "any";
  size: "small" | "medium" | "large" | null;
  region: string | null;
};

const THRESHOLD = 90;

export default function SwipeDeck({
  activeDogId,
  filters,
  onOpenFilters,
  onMatched,
}: {
  activeDogId: string;
  filters: DeckFilterState;
  onOpenFilters: () => void;
  onMatched: (card: DeckCard) => void;
}) {
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<{ dx: number; dy: number; active: boolean }>({ dx: 0, dy: 0, active: false });
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const fetchDeck = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ swiperDogId: activeDogId, breedMode: filters.breedMode, limit: "12" });
      if (filters.size) qs.set("size", filters.size);
      if (filters.region) qs.set("region", filters.region);
      const res = await fetch(`/api/breeding/deck?${qs.toString()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; cards?: DeckCard[] } | null;
      setCards(data?.ok && Array.isArray(data.cards) ? data.cards : []);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [activeDogId, filters.breedMode, filters.size, filters.region]);

  useEffect(() => {
    void fetchDeck();
  }, [fetchDeck]);

  const commitSwipe = useCallback(
    async (direction: "LIKE" | "PASS", card: DeckCard) => {
      setBusy(true);
      try {
        const res = await fetch("/api/breeding/swipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ swiperDogId: activeDogId, targetDogId: card.matingProfileId, direction }),
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; matched?: boolean } | null;
        if (data?.ok && data.matched) onMatched(card);
      } catch {
        // ignore — the card is already gone from the deck
      } finally {
        setBusy(false);
      }
    },
    [activeDogId, onMatched],
  );

  const swipeTop = useCallback(
    (direction: "LIKE" | "PASS") => {
      if (busy) return;
      const top = cards[0];
      if (!top) return;
      setCards((prev) => prev.slice(1));
      setDrag({ dx: 0, dy: 0, active: false });
      void commitSwipe(direction, top);
    },
    [busy, cards, commitSwipe],
  );

  // Pointer drag on the top card.
  const onPointerDown = (e: React.PointerEvent) => {
    if (busy) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ dx: 0, dy: 0, active: true });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    setDrag({ dx: e.clientX - startRef.current.x, dy: e.clientY - startRef.current.y, active: true });
  };
  const onPointerEnd = () => {
    if (!startRef.current) return;
    const { dx } = drag;
    startRef.current = null;
    if (dx > THRESHOLD) swipeTop("LIKE");
    else if (dx < -THRESHOLD) swipeTop("PASS");
    else setDrag({ dx: 0, dy: 0, active: false });
  };

  const top = cards[0];
  const next = cards[1];
  const likeOpacity = Math.max(0, Math.min(1, drag.dx / THRESHOLD));
  const nopeOpacity = Math.max(0, Math.min(1, -drag.dx / THRESHOLD));

  return (
    <div className="flex h-full flex-col">
      {/* Filters row */}
      <div className="flex shrink-0 items-center justify-end px-4 pb-2">
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm active:scale-95"
        >
          <SlidersHorizontal className="h-4 w-4 text-[#7c3aed]" /> Filtres
        </button>
      </div>

      {/* Card stack */}
      <div className="relative flex-1 px-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
          </div>
        ) : !top ? (
          <BreedingEmptyState
            icon={<PawPrint className="h-8 w-8 text-[#7c3aed]" />}
            title="Plus personne pour l'instant"
            subtitle="Reviens plus tard ou élargis tes filtres — de nouveaux chiens arrivent régulièrement."
            action={
              <button
                type="button"
                onClick={() => void fetchDeck()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white active:scale-95"
              >
                <RefreshCw className="h-4 w-4" /> Rafraîchir
              </button>
            }
          />
        ) : (
          <div className="relative h-full">
            {next ? (
              <div className="absolute inset-0 scale-[0.96] opacity-80" style={{ transformOrigin: "center 60%" }}>
                <MatingCard card={next} />
              </div>
            ) : null}
            <div
              className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
              style={{
                transform: `translate(${drag.dx}px, ${drag.dy * 0.15}px) rotate(${drag.dx / 22}deg)`,
                transition: drag.active ? "none" : "transform 260ms cubic-bezier(0.22,1,0.36,1)",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            >
              <MatingCard card={top} />
              {/* LIKE / NOPE stamps */}
              <div
                className="pointer-events-none absolute left-5 top-8 rotate-[-18deg] rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-extrabold uppercase text-emerald-400"
                style={{ opacity: likeOpacity }}
              >
                Oui
              </div>
              <div
                className="pointer-events-none absolute right-5 top-8 rotate-[18deg] rounded-lg border-4 border-rose-500 px-3 py-1 text-2xl font-extrabold uppercase text-rose-500"
                style={{ opacity: nopeOpacity }}
              >
                Non
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Like / Pass buttons */}
      {top && !loading ? (
        <div className="flex shrink-0 items-center justify-center gap-8 py-4">
          <button
            type="button"
            aria-label="Passer"
            onClick={() => swipeTop("PASS")}
            disabled={busy}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-rose-500 shadow-[0_8px_24px_rgba(2,6,23,0.16)] active:scale-90 disabled:opacity-50"
          >
            <X className="h-8 w-8" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            aria-label="J'aime"
            onClick={() => swipeTop("LIKE")}
            disabled={busy}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-[0_10px_28px_rgba(124,58,237,0.45)] active:scale-90 disabled:opacity-50"
          >
            <Heart className="h-8 w-8" fill="currentColor" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
