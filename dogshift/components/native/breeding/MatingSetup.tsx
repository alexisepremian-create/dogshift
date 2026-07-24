"use client";

import { useEffect, useState } from "react";
import { Check, Dog } from "lucide-react";

import { BREEDING_ACCEPT_LABEL, BREEDING_DISCLAIMER, MATING_GOAL_LABELS, SWISS_CANTONS } from "@/lib/breeding/legalCopy";
import type { MatingGoalValue, OwnerDog } from "./types";

type MatingProfileRow = {
  dogProfileId: string;
  enabled: boolean;
  goal: MatingGoalValue;
  bio: string | null;
  region: string | null;
  acceptedTermsAt: string | null;
};

type Editor = {
  dogId: string;
  sex: "MALE" | "FEMALE" | null;
  goal: MatingGoalValue;
  region: string;
  bio: string;
  accept: boolean;
};

export default function MatingSetup({ onChanged }: { onChanged?: () => void }) {
  const [dogs, setDogs] = useState<OwnerDog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MatingProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [dRes, pRes] = await Promise.all([
        fetch("/api/account/dogs", { cache: "no-store" }),
        fetch("/api/breeding/profile", { cache: "no-store" }),
      ]);
      const dData = (await dRes.json().catch(() => null)) as { dogs?: OwnerDog[] } | null;
      const pData = (await pRes.json().catch(() => null)) as { ok?: boolean; profiles?: Array<MatingProfileRow & { dog: unknown }> } | null;
      setDogs(dData?.dogs ?? []);
      const map: Record<string, MatingProfileRow> = {};
      (pData?.profiles ?? []).forEach((p) => {
        map[p.dogProfileId] = { dogProfileId: p.dogProfileId, enabled: p.enabled, goal: p.goal, bio: p.bio, region: p.region, acceptedTermsAt: p.acceptedTermsAt };
      });
      setProfiles(map);
    } catch {
      setDogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openEditor = (dog: OwnerDog) => {
    const p = profiles[dog.id];
    setError(null);
    setEditor({
      dogId: dog.id,
      sex: dog.sex,
      goal: p?.goal ?? "EXPLORING",
      region: p?.region ?? "",
      bio: p?.bio ?? "",
      accept: Boolean(p?.acceptedTermsAt),
    });
  };

  const save = async (enable: boolean) => {
    if (!editor) return;
    setError(null);
    if (enable && !editor.sex) {
      setError("Choisis le sexe de ton chien.");
      return;
    }
    if (enable && !editor.accept) {
      setError("Coche la case de confirmation pour activer.");
      return;
    }
    setSaving(true);
    try {
      // Persist the dog's sex (lives on DogProfile) if it changed.
      const currentDog = dogs.find((d) => d.id === editor.dogId);
      if (editor.sex && editor.sex !== currentDog?.sex) {
        await fetch(`/api/account/dogs/${editor.dogId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sex: editor.sex }),
        });
      }
      const res = await fetch("/api/breeding/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dogProfileId: editor.dogId,
          enabled: enable,
          goal: editor.goal,
          region: editor.region || null,
          bio: editor.bio || null,
          acceptTerms: editor.accept,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error === "SEX_REQUIRED" ? "Choisis le sexe de ton chien." : "Une erreur est survenue.");
        return;
      }
      setEditor(null);
      await load();
      onChanged?.();
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
      </div>
    );
  }

  if (dogs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed]/10">
          <Dog className="h-8 w-8 text-[#7c3aed]" />
        </div>
        <p className="text-base font-semibold text-slate-900">Ajoute d&apos;abord ton chien</p>
        <p className="text-sm text-slate-500">Crée le profil de ton chien dans « Mes chiens », puis reviens ici pour lui trouver un partenaire.</p>
      </div>
    );
  }

  const sexBtn = (active: boolean) =>
    `flex-1 rounded-2xl py-3 text-sm font-semibold transition active:scale-95 ${active ? "bg-[#7c3aed] text-white" : "bg-slate-100 text-slate-700"}`;

  return (
    <div className="h-full overflow-y-auto px-4 pb-6">
      <p className="px-1 pb-2 pt-1 text-sm text-slate-500">Active un chien pour le rendre visible dans les rencontres.</p>
      <div className="space-y-3">
        {dogs.map((dog) => {
          const p = profiles[dog.id];
          const open = editor?.dogId === dog.id;
          return (
            <div key={dog.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button type="button" onClick={() => (open ? setEditor(null) : openEditor(dog))} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <div>
                  <p className="text-base font-semibold text-slate-900">{dog.name}</p>
                  <p className="text-xs text-slate-500">{dog.breed ?? "Race non précisée"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p?.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {p?.enabled ? "Visible" : "Inactif"}
                </span>
              </button>

              {open && editor ? (
                <div className="border-t border-slate-100 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">Sexe</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={sexBtn(editor.sex === "MALE")} onClick={() => setEditor({ ...editor, sex: "MALE" })}>Mâle</button>
                    <button type="button" className={sexBtn(editor.sex === "FEMALE")} onClick={() => setEditor({ ...editor, sex: "FEMALE" })}>Femelle</button>
                  </div>
                  {dog.neutered === true ? (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">Ton chien est indiqué stérilisé — il n&apos;apparaîtra pas dans les rencontres des autres.</p>
                  ) : null}

                  <p className="mt-4 text-sm font-semibold text-slate-900">Objectif</p>
                  <select value={editor.goal} onChange={(e) => setEditor({ ...editor, goal: e.target.value as MatingGoalValue })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900">
                    {(Object.keys(MATING_GOAL_LABELS) as MatingGoalValue[]).map((g) => (
                      <option key={g} value={g}>{MATING_GOAL_LABELS[g]}</option>
                    ))}
                  </select>

                  <p className="mt-4 text-sm font-semibold text-slate-900">Région</p>
                  <select value={editor.region} onChange={(e) => setEditor({ ...editor, region: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900">
                    <option value="">Non précisée</option>
                    {SWISS_CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <p className="mt-4 text-sm font-semibold text-slate-900">Description</p>
                  <textarea value={editor.bio} onChange={(e) => setEditor({ ...editor, bio: e.target.value.slice(0, 500) })} rows={3} placeholder="Caractère, pedigree, ce que tu recherches…" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900" />

                  <label className="mt-4 flex items-start gap-3">
                    <button type="button" onClick={() => setEditor({ ...editor, accept: !editor.accept })} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${editor.accept ? "border-[#7c3aed] bg-[#7c3aed] text-white" : "border-slate-300 bg-white"}`} aria-pressed={editor.accept}>
                      {editor.accept ? <Check className="h-4 w-4" /> : null}
                    </button>
                    <span className="text-sm text-slate-700">{BREEDING_ACCEPT_LABEL}</span>
                  </label>
                  <p className="mt-2 text-[11px] leading-snug text-slate-400">{BREEDING_DISCLAIMER}</p>

                  {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

                  <div className="mt-4 flex gap-2">
                    {p?.enabled ? (
                      <button type="button" onClick={() => save(false)} disabled={saving} className="flex-1 rounded-full bg-slate-100 py-3 text-sm font-semibold text-slate-700 active:scale-95 disabled:opacity-50">Mettre en pause</button>
                    ) : null}
                    <button type="button" onClick={() => save(true)} disabled={saving} className="flex-1 rounded-full bg-[#7c3aed] py-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-50">
                      {saving ? "…" : p?.enabled ? "Enregistrer" : "Activer"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
