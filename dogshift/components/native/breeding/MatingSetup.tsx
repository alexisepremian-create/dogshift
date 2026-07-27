"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Dog, Plus, X, Navigation, Loader2, ImagePlus, Settings } from "lucide-react";

import { BREEDING_ACCEPT_LABEL, BREEDING_DISCLAIMER, MATING_GOAL_LABELS } from "@/lib/breeding/legalCopy";
import { openNativeAppSettings } from "@/lib/native/capacitorBridge";
import BreedingEmptyState from "./BreedingEmptyState";
import GenderToggle from "./GenderToggle";
import { uploadBreedingPhoto, saveBreedingPhotos, type PhotoItem } from "./photoClient";
import type { MatingGoalValue, OwnerDog } from "./types";

type MatingProfileRow = {
  dogProfileId: string;
  enabled: boolean;
  goal: MatingGoalValue;
  bio: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  locationLabel: string | null;
  photoItems: PhotoItem[];
  acceptedTermsAt: string | null;
};

type Editor = {
  dogId: string;
  sex: "MALE" | "FEMALE" | null;
  goal: MatingGoalValue;
  lat: number | null;
  lng: number | null;
  locationLabel: string | null;
  photos: PhotoItem[];
  bio: string;
  accept: boolean;
};

const MAX_PHOTOS = 6;

export default function MatingSetup({ onChanged }: { onChanged?: () => void }) {
  const [dogs, setDogs] = useState<OwnerDog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MatingProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [adding, setAdding] = useState(false);
  const [newDog, setNewDog] = useState<{ name: string; breed: string; sex: "MALE" | "FEMALE" | null }>({ name: "", breed: "", sex: null });
  const [addErr, setAddErr] = useState<string | null>(null);

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
        map[p.dogProfileId] = { dogProfileId: p.dogProfileId, enabled: p.enabled, goal: p.goal, bio: p.bio, region: p.region, lat: p.lat, lng: p.lng, locationLabel: p.locationLabel, photoItems: p.photoItems ?? [], acceptedTermsAt: p.acceptedTermsAt };
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
    setPermDenied(false);
    setEditor({
      dogId: dog.id,
      sex: dog.sex,
      goal: p?.goal ?? "EXPLORING",
      lat: p?.lat ?? null,
      lng: p?.lng ?? null,
      locationLabel: p?.locationLabel ?? null,
      photos: p?.photoItems ?? [],
      bio: p?.bio ?? "",
      accept: Boolean(p?.acceptedTermsAt),
    });
  };

  const onPickPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !editor) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const room = MAX_PHOTOS - editor.photos.length;
      const toAdd = files.slice(0, Math.max(0, room));
      const keys = await Promise.all(toAdd.map((f) => uploadBreedingPhoto(f)));
      const nextKeys = [...editor.photos.map((p) => p.key), ...keys];
      const saved = await saveBreedingPhotos(editor.dogId, nextKeys);
      setEditor((prev) => (prev ? { ...prev, photos: saved } : prev));
    } catch {
      setError("L'ajout de la photo a échoué.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async (key: string) => {
    if (!editor || photoBusy) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const nextKeys = editor.photos.filter((p) => p.key !== key).map((p) => p.key);
      const saved = await saveBreedingPhotos(editor.dogId, nextKeys);
      setEditor((prev) => (prev ? { ...prev, photos: saved } : prev));
    } catch {
      setError("La suppression a échoué.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const captureLocation = async () => {
    setLocating(true);
    setError(null);
    setPermDenied(false);
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location === "denied" && perm.coarseLocation !== "granted") {
          setPermDenied(true);
          setError("La localisation est désactivée pour DogShift.");
          return;
        }
      } catch { /* web fallback — the browser prompt handles it */ }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      let label: string | null = null;
      try {
        const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
        if (key) {
          const r = await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${encodeURIComponent(key)}&language=fr&limit=1&types=municipality,locality,place`);
          const j = (await r.json().catch(() => null)) as { features?: Array<{ text?: string }> } | null;
          label = (typeof j?.features?.[0]?.text === "string" && j.features[0].text.trim()) || null;
        }
      } catch { /* keep coords without a label */ }
      setEditor((prev) => (prev ? { ...prev, lat, lng, locationLabel: label } : prev));
    } catch {
      // Most failures here are a denied/disabled permission — offer the shortcut.
      setPermDenied(true);
      setError("Impossible d'obtenir ta position. Vérifie l'autorisation de localisation.");
    } finally {
      setLocating(false);
    }
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
          lat: editor.lat,
          lng: editor.lng,
          locationLabel: editor.locationLabel,
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

  const closeAdd = () => { setAdding(false); setAddErr(null); setNewDog({ name: "", breed: "", sex: null }); };

  const addDog = async () => {
    setAddErr(null);
    const name = newDog.name.trim();
    if (!name) {
      setAddErr("Donne un nom à ton chien.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, breed: newDog.breed.trim() || null, sex: newDog.sex }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setAddErr(data?.error ? `Impossible d'ajouter le chien (${data.error}).` : "Impossible d'ajouter le chien.");
        return;
      }
      setNewDog({ name: "", breed: "", sex: null });
      setAdding(false);
      await load();
    } catch {
      setAddErr("Impossible d'ajouter le chien.");
    } finally {
      setSaving(false);
    }
  };

  const addModal = adding ? (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 px-6" onClick={closeAdd} role="dialog" aria-modal="true" aria-label="Nouveau chien">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-[0_24px_60px_rgba(2,6,23,0.28)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Nouveau chien</h3>
          <button type="button" onClick={closeAdd} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>
        <input value={newDog.name} onChange={(e) => setNewDog({ ...newDog, name: e.target.value.slice(0, 60) })} placeholder="Nom (ex. Milo)" className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900" />
        <input value={newDog.breed} onChange={(e) => setNewDog({ ...newDog, breed: e.target.value.slice(0, 80) })} placeholder="Race (ex. Labrador)" className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900" />
        <div className="mt-3">
          <GenderToggle value={newDog.sex} onChange={(sex) => setNewDog({ ...newDog, sex })} />
        </div>
        {addErr ? <p className="mt-3 text-sm font-medium text-rose-600">{addErr}</p> : null}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={closeAdd} className="flex-1 rounded-full bg-slate-100 py-3 text-sm font-semibold text-slate-700 active:scale-95">Annuler</button>
          <button type="button" onClick={addDog} disabled={saving} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#7c3aed] py-3 text-sm font-semibold text-white active:scale-95 disabled:opacity-50">
            <Plus className="h-4 w-4" /> {saving ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
      </div>
    );
  }

  if (dogs.length === 0) {
    return (
      <div className="h-full overflow-y-auto px-4 py-4">
        <BreedingEmptyState
          icon={<Dog className="h-8 w-8 text-[#7c3aed]" />}
          title="Ajoute ton chien"
          subtitle="Crée le profil de ton chien ici pour lui trouver un partenaire."
          action={
            <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white active:scale-95">
              <Plus className="h-4 w-4" /> Ajouter un chien
            </button>
          }
        />
        {addModal}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-6">
      <p className="px-1 pb-2 pt-1 text-sm text-slate-500">Active un chien pour le rendre visible dans les rencontres.</p>
      <button type="button" onClick={() => setAdding(true)} className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#7c3aed]/40 bg-[#7c3aed]/5 py-3 text-sm font-semibold text-[#7c3aed] active:scale-[0.99]">
        <Plus className="h-4 w-4" /> Ajouter un chien
      </button>
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
                  <div className="mt-2">
                    <GenderToggle value={editor.sex} onChange={(sex) => setEditor({ ...editor, sex })} />
                  </div>
                  {dog.neutered === true ? (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">Ton chien est indiqué stérilisé — il n&apos;apparaîtra pas dans les rencontres des autres.</p>
                  ) : null}

                  <p className="mt-4 text-sm font-semibold text-slate-900">Photos</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {editor.photos.map((ph) => (
                      <div key={ph.key} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ph.url} alt="Photo" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(ph.key)}
                          disabled={photoBusy}
                          aria-label="Retirer la photo"
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white active:scale-90"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {editor.photos.length < MAX_PHOTOS ? (
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoBusy}
                        style={{ touchAction: "manipulation" }}
                        className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-[#7c3aed]/40 bg-[#7c3aed]/5 text-[#7c3aed] active:scale-95 disabled:opacity-60"
                      >
                        {photoBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
                      </button>
                    ) : null}
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={onPickPhotos} className="hidden" />

                  <p className="mt-4 text-sm font-semibold text-slate-900">Objectif</p>
                  <select value={editor.goal} onChange={(e) => setEditor({ ...editor, goal: e.target.value as MatingGoalValue })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900">
                    {(Object.keys(MATING_GOAL_LABELS) as MatingGoalValue[]).map((g) => (
                      <option key={g} value={g}>{MATING_GOAL_LABELS[g]}</option>
                    ))}
                  </select>

                  <p className="mt-4 text-sm font-semibold text-slate-900">Position</p>
                  <button
                    type="button"
                    onClick={captureLocation}
                    disabled={locating}
                    style={{ touchAction: "manipulation" }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/5 px-4 py-3 text-sm font-semibold text-[#7c3aed] active:scale-[0.99] disabled:opacity-60"
                  >
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                    {editor.lat != null && editor.lng != null
                      ? `Position : ${editor.locationLabel ?? "enregistrée"}`
                      : "Utiliser ma position"}
                  </button>
                  {permDenied ? (
                    <button
                      type="button"
                      onClick={() => void openNativeAppSettings()}
                      style={{ touchAction: "manipulation" }}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
                    >
                      <Settings className="h-4 w-4" /> Ouvrir les réglages
                    </button>
                  ) : null}
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-400">Ta position sert à afficher la distance aux autres chiens. On ne montre jamais ton adresse exacte.</p>

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
      {addModal}
    </div>
  );
}
