"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Dog, Heart } from "lucide-react";

import SwipeDeck, { type DeckFilterState } from "./SwipeDeck";
import DeckFilters from "./DeckFilters";
import MatchesTab from "./MatchesTab";
import MatingSetup from "./MatingSetup";
import type { DeckCard } from "./types";

type Tab = "deck" | "matches" | "profile";

type EnabledProfile = { id: string; dogName: string };

export default function BreedingHome() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("deck");
  const [enabled, setEnabled] = useState<EnabledProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [filters, setFilters] = useState<DeckFilterState>({ breedMode: "any", size: null, region: null });
  const [showFilters, setShowFilters] = useState(false);
  const [matchCard, setMatchCard] = useState<DeckCard | null>(null);

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/breeding/profile", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; profiles?: Array<{ id: string; enabled: boolean; dog: { name: string } }> }
        | null;
      const en = (data?.profiles ?? []).filter((p) => p.enabled).map((p) => ({ id: p.id, dogName: p.dog.name }));
      setEnabled(en);
      setActiveId((cur) => cur ?? en[0]?.id ?? null);
    } catch {
      setEnabled([]);
    } finally {
      setProfilesLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const tabBtn = (t: Tab) =>
    `flex-1 rounded-full py-2 text-sm font-semibold transition ${tab === t ? "bg-white text-[#7c3aed] shadow-sm" : "text-slate-500"}`;

  return (
    // Floors above the global bottom nav (var --ds-bottom-nav-h) so the app's
    // bottom navigation stays visible + tappable on this screen (founder).
    <div className="fixed inset-x-0 top-0 z-[45] flex flex-col bg-slate-50" style={{ bottom: "var(--ds-bottom-nav-h, 0px)" }}>
      {/* Header */}
      <div className="shrink-0 bg-white px-4 pb-2" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Rencontres</h1>
          <button type="button" onClick={() => router.push("/")} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Tabs */}
        <div className="mt-2 flex gap-1 rounded-full bg-slate-100 p-1">
          <button type="button" className={tabBtn("deck")} onClick={() => setTab("deck")}>Rencontres</button>
          <button type="button" className={tabBtn("matches")} onClick={() => setTab("matches")}>Matchs</button>
          <button type="button" className={tabBtn("profile")} onClick={() => setTab("profile")}>Mon profil</button>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1">
        {tab === "deck" ? (
          !profilesLoaded ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
            </div>
          ) : activeId ? (
            <SwipeDeck activeDogId={activeId} filters={filters} onOpenFilters={() => setShowFilters(true)} onMatched={(c) => setMatchCard(c)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed]/10">
                <Dog className="h-8 w-8 text-[#7c3aed]" />
              </div>
              <p className="text-base font-semibold text-slate-900">Active ton chien</p>
              <p className="text-sm text-slate-500">Configure le profil d&apos;accouplement de ton chien pour commencer à swiper.</p>
              <button type="button" onClick={() => setTab("profile")} className="mt-1 rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white active:scale-95">Configurer</button>
            </div>
          )
        ) : tab === "matches" ? (
          <MatchesTab />
        ) : (
          <MatingSetup onChanged={loadProfiles} />
        )}
      </div>

      {/* Active-dog switcher (only when >1 enabled) */}
      {tab === "deck" && enabled.length > 1 ? (
        <div className="shrink-0 bg-white px-4 py-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}>
          <div className="flex gap-2 overflow-x-auto">
            {enabled.map((p) => (
              <button key={p.id} type="button" onClick={() => setActiveId(p.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${activeId === p.id ? "bg-[#7c3aed] text-white" : "bg-slate-100 text-slate-600"}`}>
                {p.dogName}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Filters sheet */}
      {showFilters ? <DeckFilters value={filters} onChange={setFilters} onClose={() => setShowFilters(false)} /> : null}

      {/* "It's a match" overlay */}
      {matchCard ? (
        <div className="fixed inset-0 z-[1300] flex flex-col items-center justify-center bg-[#7c3aed]/95 px-8 text-center text-white">
          <Heart className="mb-3 h-14 w-14 fill-white text-white" />
          <p className="text-3xl font-extrabold">C&apos;est un match !</p>
          <p className="mt-2 text-base text-white/90">Toi et {matchCard.dogName} vous plaisez.</p>
          {matchCard.photoUrl ? <img src={matchCard.photoUrl} alt={matchCard.dogName} className="mt-6 h-32 w-32 rounded-full border-4 border-white object-cover" /> : null}
          <button type="button" onClick={() => { setMatchCard(null); setTab("matches"); }} className="mt-8 w-full max-w-[280px] rounded-full bg-white py-3 text-base font-bold text-[#7c3aed] active:scale-95">Envoyer un message</button>
          <button type="button" onClick={() => setMatchCard(null)} className="mt-3 text-sm font-semibold text-white/80">Continuer à swiper</button>
        </div>
      ) : null}
    </div>
  );
}
