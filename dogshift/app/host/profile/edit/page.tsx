"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Pencil } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";

import type { DogSize, ServiceType } from "@/lib/mockSitters";
import {
  getDefaultHostProfile,
  getHostCompletion,
  loadHostProfileFromStorage,
  saveHostProfileToStorage,
  type HostProfileV1,
} from "@/lib/hostProfile";

const SERVICE_LABELS: Record<ServiceType, string> = {
  Promenade: "Promenade",
  Garde: "Garde",
  Pension: "Pension",
};

const DOG_SIZE_LABELS: Record<DogSize, string> = {
  Petit: "Petit",
  Moyen: "Moyen",
  Grand: "Grand",
};

function parsePrice(raw: string) {
  const cleaned = raw.replace(",", ".").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export default function HostProfileEditPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [effectiveSitterId, setEffectiveSitterId] = useState<string | null>(null);
  const [effectiveSitterIdChecked, setEffectiveSitterIdChecked] = useState(false);

  const [published, setPublished] = useState(false);

  const [profile, setProfile] = useState<HostProfileV1>(() => getDefaultHostProfile(""));
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [verificationIdFileName, setVerificationIdFileName] = useState<string | null>(null);
  const [verificationSelfieFileName, setVerificationSelfieFileName] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }

    setEffectiveSitterIdChecked(false);
    void (async () => {
      try {
        const res = await fetch("/api/host/profile", { method: "GET" });
        const payload = (await res.json()) as {
          ok?: boolean;
          sitterId?: string | null;
          profile?: unknown;
          published?: boolean;
          publishedAt?: string | null;
        };
        if (!res.ok || !payload.ok) {
          setEffectiveSitterId(null);
          return;
        }

        const apiSitterId = typeof payload.sitterId === "string" && payload.sitterId.trim() ? payload.sitterId.trim() : null;
        const nextSitterId = apiSitterId;
        if (!nextSitterId) {
          setEffectiveSitterId(null);
          return;
        }
        setEffectiveSitterId(nextSitterId);

        const remote = payload.profile as Partial<HostProfileV1> | null | undefined;
        if (remote && typeof remote === "object" && remote.profileVersion === 1 && remote.sitterId === nextSitterId) {
          setProfile(remote as HostProfileV1);
          setPublished(Boolean(payload.published));
          setAvatarFileName(null);
          setVerificationIdFileName(null);
          setVerificationSelfieFileName(null);
          setVerificationError(null);
          return;
        }

        const stored = loadHostProfileFromStorage(nextSitterId);
        setProfile(stored ?? getDefaultHostProfile(nextSitterId));
        setPublished(Boolean(payload.published));
        setAvatarFileName(null);
        setVerificationIdFileName(null);
        setVerificationSelfieFileName(null);
        setVerificationError(null);
      } catch {
        setEffectiveSitterId(null);
      } finally {
        setEffectiveSitterIdChecked(true);
      }
    })();
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const scrollToHash = (hash: string) => {
      const raw = hash.startsWith("#") ? hash.slice(1) : hash;
      const id = raw === "bio" ? "description" : raw;
      if (!id) return;

      let attempts = 0;
      const tryScroll = () => {
        attempts += 1;
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (attempts < 8) {
          window.setTimeout(tryScroll, 75);
        }
      };

      window.setTimeout(tryScroll, 0);
    };

    scrollToHash(window.location.hash);

    const onHashChange = () => scrollToHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (!isLoaded) return null;
  if (!isSignedIn) return null;

  async function persistProfile(nextProfile: HostProfileV1) {
    if (!effectiveSitterId) return;

    const normalized: HostProfileV1 = {
      ...nextProfile,
      sitterId: effectiveSitterId,
      profileVersion: 1,
      updatedAt: new Date().toISOString(),
    };

    setProfile(normalized);
    saveHostProfileToStorage(normalized);

    try {
      const res = await fetch("/api/host/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...normalized, published }),
      });
      const payload = (await res.json()) as { ok?: boolean };
      if (!res.ok || !payload.ok) {
        // silent: dashboard/edit UI already shows local state
      }
    } catch {
      // ignore
    }
  }

  const completion = useMemo(() => getHostCompletion(profile), [profile]);

  const activeServices = useMemo(
    () => (Object.keys(profile.services) as ServiceType[]).filter((svc) => profile.services[svc]),
    [profile.services]
  );

  const pricingValid = useMemo(
    () => activeServices.every((svc) => typeof profile.pricing?.[svc] === "number"),
    [activeServices, profile.pricing]
  );

  function onSave() {
    setSaved(false);
    setError(null);

    if (activeServices.length === 0) {
      setError("Active au moins un service.");
      return;
    }

    if (!pricingValid) {
      setError("Ajoute un prix pour chaque service activé.");
      return;
    }

    if (!effectiveSitterId) return;
    const nextProfile: HostProfileV1 = {
      ...profile,
      sitterId: effectiveSitterId,
      profileVersion: 1,
      updatedAt: new Date().toISOString(),
    };
    setProfile(nextProfile);
    saveHostProfileToStorage(nextProfile);

    void (async () => {
      try {
        const res = await fetch("/api/host/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...nextProfile, published }),
        });
        const payload = (await res.json()) as { ok?: boolean; error?: string; profile?: unknown };
        if (!res.ok || !payload.ok || !payload.profile) {
          setError(payload?.error ? `Impossible d’enregistrer le profil (${payload.error}).` : "Impossible d’enregistrer le profil.");
          setSaved(false);
          return;
        }

        try {
          const getRes = await fetch("/api/host/profile", { method: "GET" });
          const getPayload = (await getRes.json()) as { ok?: boolean; profile?: unknown; sitterId?: string | null };
          if (getRes.ok && getPayload.ok && getPayload.profile && typeof getPayload.sitterId === "string") {
            const remote = getPayload.profile as Partial<HostProfileV1> | null | undefined;
            if (remote && typeof remote === "object" && remote.profileVersion === 1 && remote.sitterId === getPayload.sitterId) {
              setProfile(remote as HostProfileV1);
              setAvatarFileName(null);
            }
          }
        } catch {
          // ignore
        }

        setSaved(true);
      } catch {
        setError("Impossible d’enregistrer le profil.");
        setSaved(false);
      }
    })();
  }

  if (!effectiveSitterId) {
    if (!effectiveSitterIdChecked) return null;

    return (
      <div className="relative grid gap-6 overflow-hidden" data-testid="host-profile-edit">
        <SunCornerGlow variant="sitterProfile" />
        <div className="relative z-10 rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Profil hôte</p>
          <p className="mt-2 text-sm text-slate-600">Ton profil hôte n’est pas encore disponible.</p>
          <div className="mt-4">
            <Link href="/become-sitter" className="text-sm font-semibold text-[var(--dogshift-blue)]">
              Créer mon profil hôte
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="host-profile-edit">
      <SunCornerGlow variant="sitterProfile" />

      <div className="relative z-10">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-sm font-semibold text-slate-600">Profil hôte</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              <Pencil className="h-6 w-6 text-slate-700" aria-hidden="true" />
              <span>Édition</span>
            </h1>
            <div className="mt-3 flex min-h-[32px] flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Profil {completion.percent}%
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <section className="relative rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
              <div id="identity" className="scroll-mt-24 p-6 sm:p-8">
                <h2 className="text-base font-semibold text-slate-900">Identité du profil public</h2>
                <p className="mt-1 text-sm text-slate-600">Ces informations sont visibles par tous sur ton profil public.</p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="host_firstName">
                      Nom visible
                    </label>
                    <input
                      id="host_firstName"
                      value={profile.firstName}
                      onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                      placeholder="ex. Camille"
                      autoComplete="given-name"
                    />
                    <p className="mt-2 text-xs text-slate-500">Visible sur ton profil public.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="host_city">
                      Ville / CP (visible)
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <input
                        id="host_city"
                        value={profile.city}
                        onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                        placeholder="Genève"
                        autoComplete="address-level2"
                      />
                      <input
                        value={profile.postalCode}
                        onChange={(e) => setProfile((p) => ({ ...p, postalCode: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                        placeholder="1201"
                        autoComplete="postal-code"
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Visible sur ton profil public.</p>
                  </div>
                </div>

                <div id="photo" className="scroll-mt-24 mt-5">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="host_photo">
                    Photo (mock)
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      id="host_photo"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setAvatarFileName(file.name);
                        const reader = new FileReader();
                        reader.onload = () => {
                          const value = typeof reader.result === "string" ? reader.result : "";
                          setProfile((p) => ({ ...p, avatarDataUrl: value || undefined }));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <label
                      htmlFor="host_photo"
                      className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                    >
                      Choisir un fichier
                    </label>
                    <p className="text-xs font-medium text-slate-600">
                      {avatarFileName
                        ? avatarFileName
                        : profile.avatarDataUrl
                          ? "Photo ajoutée"
                          : "Aucun fichier choisi"}
                    </p>
                  </div>
                  {profile.avatarDataUrl ? (
                    <img
                      src={profile.avatarDataUrl}
                      alt="Aperçu"
                      className="mt-3 h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
                    />
                  ) : null}
                </div>
              </div>

              <div id="description" className="scroll-mt-24 border-t border-slate-200 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-base font-semibold text-slate-900">Présentation</h2>
                  <p className="text-xs font-semibold text-slate-500">{profile.bio.length}/320</p>
                </div>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value.slice(0, 320) }))}
                  className="mt-4 w-full min-h-[140px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                  placeholder="Décrivez votre expérience, votre approche et comment vous prenez soin des chiens."
                />
              </div>

              <div id="services" className="scroll-mt-24 border-t border-slate-200 p-6 sm:p-8">
                <h2 className="text-base font-semibold text-slate-900">Services & tarifs</h2>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((svc) => (
                    <button
                      key={svc}
                      type="button"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          services: { ...p.services, [svc]: !p.services[svc] },
                        }))
                      }
                      className={
                        profile.services[svc]
                          ? "rounded-2xl border border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] px-4 py-3 text-sm font-semibold text-[var(--dogshift-blue)]"
                          : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                      }
                    >
                      {SERVICE_LABELS[svc]}
                    </button>
                  ))}
                </div>

                <div id="pricing" className="scroll-mt-24 mt-6 grid gap-4 sm:grid-cols-3">
                  {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((svc) => {
                    const enabled = profile.services[svc];
                    const current = profile.pricing?.[svc];
                    return (
                      <div key={svc} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold text-slate-700">
                          {SERVICE_LABELS[svc]} (CHF{svc === "Pension" ? "/jour" : "/heure"})
                        </p>
                        <input
                          value={typeof current === "number" ? String(current) : ""}
                          disabled={!enabled}
                          onChange={(e) => {
                            const v = parsePrice(e.target.value);
                            setProfile((p) => ({
                              ...p,
                              pricing: { ...p.pricing, [svc]: v === null ? undefined : v },
                            }));
                          }}
                          inputMode="decimal"
                          placeholder={enabled ? "ex. 35" : "Désactivé"}
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)] disabled:cursor-not-allowed disabled:bg-slate-100"
                        />
                      </div>
                    );
                  })}
                </div>

                {!pricingValid && activeServices.length > 0 ? (
                  <p className="mt-3 text-sm font-medium text-rose-600">Prix manquant pour un service activé.</p>
                ) : null}
              </div>

              <div id="dogSizes" className="scroll-mt-24 border-t border-slate-200 p-6 sm:p-8">
                <h2 className="text-base font-semibold text-slate-900">Taille de chien acceptée</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(DOG_SIZE_LABELS) as DogSize[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          dogSizes: { ...p.dogSizes, [size]: !p.dogSizes[size] },
                        }))
                      }
                      className={
                        profile.dogSizes[size]
                          ? "rounded-full border border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] px-4 py-2 text-xs font-semibold text-[var(--dogshift-blue)]"
                          : "rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                      }
                    >
                      {DOG_SIZE_LABELS[size]}
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Annulation flexible</p>
                    <p className="mt-1 text-sm text-slate-600">Le client peut annuler facilement (mock).</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, cancellationFlexible: !p.cancellationFlexible }))}
                    className={
                      profile.cancellationFlexible
                        ? "inline-flex h-9 w-14 items-center rounded-full bg-[var(--dogshift-blue)] p-1 transition"
                        : "inline-flex h-9 w-14 items-center rounded-full bg-slate-200 p-1 transition"
                    }
                    aria-label="Annulation flexible"
                  >
                    <span
                      className={
                        profile.cancellationFlexible
                          ? "h-7 w-7 translate-x-5 rounded-full bg-white shadow-sm transition"
                          : "h-7 w-7 translate-x-0 rounded-full bg-white shadow-sm transition"
                      }
                    />
                  </button>
                </div>

                {profile.services.Pension ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-sm font-semibold text-slate-900">Pension (détails)</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700" htmlFor="host_housing">
                          Type de logement
                        </label>
                        <select
                          id="host_housing"
                          value={profile.boardingDetails?.housingType ?? ""}
                          onChange={(e) =>
                            setProfile((p) => ({
                              ...p,
                              boardingDetails: {
                                ...p.boardingDetails,
                                housingType: (e.target.value as "Appartement" | "Maison" | "") || undefined,
                              },
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                        >
                          <option value="">Sélectionner</option>
                          <option value="Appartement">Appartement</option>
                          <option value="Maison">Maison</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700" htmlFor="host_boarding_notes">
                          Notes (optionnel)
                        </label>
                        <input
                          id="host_boarding_notes"
                          value={profile.boardingDetails?.notes ?? ""}
                          onChange={(e) =>
                            setProfile((p) => ({
                              ...p,
                              boardingDetails: { ...p.boardingDetails, notes: e.target.value },
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                          placeholder="ex. Jardin clos, parc à 5 min"
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                        <input
                          type="checkbox"
                          checked={Boolean(profile.boardingDetails?.hasGarden)}
                          onChange={(e) =>
                            setProfile((p) => ({
                              ...p,
                              boardingDetails: { ...p.boardingDetails, hasGarden: e.target.checked },
                            }))
                          }
                        />
                        Jardin
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                        <input
                          type="checkbox"
                          checked={Boolean(profile.boardingDetails?.hasOtherPets)}
                          onChange={(e) =>
                            setProfile((p) => ({
                              ...p,
                              boardingDetails: { ...p.boardingDetails, hasOtherPets: e.target.checked },
                            }))
                          }
                        />
                        Autres animaux
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-slate-200 p-6 sm:p-8">
                <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Annonce publiée</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {published ? "Votre annonce est visible dans la recherche." : "Votre annonce est cachée (brouillon)."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPublished((v) => !v)}
                    className={
                      published
                        ? "inline-flex h-9 w-14 items-center rounded-full bg-[var(--dogshift-blue)] p-1 transition"
                        : "inline-flex h-9 w-14 items-center rounded-full bg-slate-200 p-1 transition"
                    }
                    aria-label="Annonce publiée"
                  >
                    <span
                      className={
                        published
                          ? "h-7 w-7 translate-x-5 rounded-full bg-white shadow-sm transition"
                          : "h-7 w-7 translate-x-0 rounded-full bg-white shadow-sm transition"
                      }
                    />
                  </button>
                </div>

                <div id="verification" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">Vérification</p>
                  {profile.verificationStatus === "verified" ? (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-semibold text-emerald-900">Vérifié</p>
                      <p className="mt-1 text-sm text-emerald-900/80">Votre profil est vérifié (mock).</p>
                    </div>
                  ) : profile.verificationStatus === "pending" ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">En cours</p>
                      <p className="mt-1 text-sm text-amber-900/80">Votre demande est en cours de vérification (mock).</p>
                      <button
                        type="button"
                        onClick={() => {
                          const next: HostProfileV1 = { ...profile, verificationStatus: "unverified" };
                          setVerificationIdFileName(null);
                          setVerificationSelfieFileName(null);
                          setVerificationError(null);
                          void persistProfile(next);
                        }}
                        className="mt-4 inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-white px-5 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50"
                      >
                        Annuler la demande
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-600">Demandez la vérification pour rassurer les clients. (mock).</p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">Pièce d’identité (obligatoire)</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <input
                              id="host_verification_id"
                              type="file"
                              accept="image/*,application/pdf"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                setVerificationError(null);
                                setVerificationIdFileName(file ? file.name : null);
                              }}
                            />
                            <label
                              htmlFor="host_verification_id"
                              className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                            >
                              Choisir un fichier
                            </label>
                            <p className="text-xs font-medium text-slate-600">{verificationIdFileName ?? "Aucun fichier choisi"}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-700">Selfie (recommandé)</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <input
                              id="host_verification_selfie"
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                setVerificationError(null);
                                setVerificationSelfieFileName(file ? file.name : null);
                              }}
                            />
                            <label
                              htmlFor="host_verification_selfie"
                              className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                            >
                              Choisir un fichier
                            </label>
                            <p className="text-xs font-medium text-slate-600">{verificationSelfieFileName ?? "Aucun fichier choisi"}</p>
                          </div>
                        </div>
                      </div>

                      {verificationError ? <p className="mt-3 text-sm font-medium text-rose-600">{verificationError}</p> : null}

                      <button
                        type="button"
                        onClick={() => {
                          if (!verificationIdFileName) {
                            setVerificationError("Ajoutez votre pièce d’identité pour demander la vérification.");
                            return;
                          }

                          const next: HostProfileV1 = { ...profile, verificationStatus: "pending" };
                          void persistProfile(next);
                        }}
                        className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                      >
                        Demander la vérification
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onSave}
                  className="mt-5 w-full rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                >
                  Enregistrer
                </button>

                {saved ? (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900">Enregistré</p>
                    <p className="mt-1 text-sm text-emerald-900/80">Vos modifications seront visibles sur votre profil public.</p>
                  </div>
                ) : null}

                {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
              </div>
          </section>
        </div>
      </div>
    </div>
  );
}
