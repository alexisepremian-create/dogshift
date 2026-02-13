"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";
import { useHostUser } from "@/components/HostUserProvider";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

import type { DogSize, ServiceType } from "@/lib/mockSitters";
import {
  getDefaultHostProfile,
  getHostCompletion,
  loadHostProfileFromStorage,
  saveHostProfileToStorage,
  type HostProfileV1,
} from "@/lib/hostProfile";

type AvailabilityPayload = { ok?: boolean; dates?: string[]; error?: string };

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

const TARIFF_RANGES: Record<ServiceType, { min: number; max: number }> = {
  Promenade: { min: 15, max: 25 },
  Garde: { min: 18, max: 30 },
  Pension: { min: 35, max: 60 },
};

function parsePrice(raw: string) {
  const cleaned = raw.replace(",", ".").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function getTariffRangeError(service: ServiceType, price: number) {
  const r = TARIFF_RANGES[service];
  if (!r) return null;
  if (!Number.isFinite(price)) return null;
  if (price < r.min || price > r.max) {
    return `Tarif ${SERVICE_LABELS[service]} : le prix doit être compris entre ${r.min} et ${r.max} CHF.`;
  }
  return null;
}

function formatZurichIsoDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function todayZurichIsoDate() {
  return formatZurichIsoDate(new Date());
}

function toIsoDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("fr-CH", { month: "long", year: "numeric" }).format(date);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function getMonthGrid(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  // Monday-first index (0..6)
  const jsDay = firstOfMonth.getDay();
  const leading = (jsDay + 6) % 7;

  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < leading; i += 1) {
    const d = new Date(month.getFullYear(), month.getMonth(), 1 - (leading - i));
    cells.push({ date: d, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]?.date ?? new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ date: d, inMonth: false });
  }
  return cells;
}

export default function HostProfileEditPage() {
  const { sitterId, profile: remoteProfile, published: remotePublished, termsAcceptedAt, termsVersion } = useHostUser();

  const termsOk = Boolean(termsAcceptedAt) && termsVersion === CURRENT_TERMS_VERSION;

  const [published, setPublished] = useState(() => Boolean(remotePublished));

  const [profile, setProfile] = useState<HostProfileV1>(() => {
    if (!sitterId) return getDefaultHostProfile("");
    const remote = remoteProfile as Partial<HostProfileV1> | null | undefined;
    if (remote && typeof remote === "object" && remote.profileVersion === 1 && remote.sitterId === sitterId) {
      return remote as HostProfileV1;
    }
    const stored = loadHostProfileFromStorage(sitterId);
    return stored ?? getDefaultHostProfile(sitterId);
  });
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [verificationIdFileName, setVerificationIdFileName] = useState<string | null>(null);
  const [verificationSelfieFileName, setVerificationSelfieFileName] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"not_verified" | "pending" | "approved" | "rejected">("not_verified");
  const [verificationNotes, setVerificationNotes] = useState<string | null>(null);
  const [verificationIdFile, setVerificationIdFile] = useState<File | null>(null);
  const [verificationSelfieFile, setVerificationSelfieFile] = useState<File | null>(null);
  const [verificationUploading, setVerificationUploading] = useState(false);
  const [verificationSubmittedAt, setVerificationSubmittedAt] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availMonth, setAvailMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [availRemote, setAvailRemote] = useState<Set<string>>(() => new Set());
  const [availDraft, setAvailDraft] = useState<Set<string>>(() => new Set());
  const [availLoading, setAvailLoading] = useState(false);
  const [availSaving, setAvailSaving] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [availSaved, setAvailSaved] = useState(false);

  const todayIso = useMemo(() => todayZurichIsoDate(), []);

  useEffect(() => {
    return;
  }, []);

  useEffect(() => {
    if (!sitterId) return;
    let canceled = false;
    setAvailLoading(true);
    setAvailError(null);
    setAvailSaved(false);
    void (async () => {
      try {
        const res = await fetch("/api/sitter/availability", { method: "GET" });
        const payload = (await res.json().catch(() => null)) as AvailabilityPayload | null;
        if (canceled) return;
        if (!res.ok || !payload?.ok) {
          setAvailError("Impossible de charger les disponibilités.");
          setAvailRemote(new Set());
          setAvailDraft(new Set());
          return;
        }
        const rows = Array.isArray(payload.dates) ? payload.dates.filter((d): d is string => typeof d === "string") : [];
        const normalized = new Set(rows);
        setAvailRemote(normalized);
        setAvailDraft(new Set(rows));
      } catch {
        if (canceled) return;
        setAvailError("Impossible de charger les disponibilités.");
        setAvailRemote(new Set());
        setAvailDraft(new Set());
      } finally {
        if (canceled) return;
        setAvailLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [sitterId]);

  useEffect(() => {
    if (!sitterId) return;
    let canceled = false;
    void (async () => {
      try {
        const res = await fetch("/api/host/verification/status", { method: "GET" });
        const payload = (await res.json().catch(() => null)) as any;
        if (canceled) return;
        if (!res.ok || !payload?.ok || !payload?.verification) return;
        const st = String(payload.verification.status ?? "not_verified");
        if (st === "pending" || st === "approved" || st === "rejected" || st === "not_verified") {
          setVerificationStatus(st);
        } else {
          setVerificationStatus("not_verified");
        }
        setVerificationNotes(typeof payload.verification.notes === "string" ? payload.verification.notes : null);
        setVerificationSubmittedAt(typeof payload.verification.submittedAt === "string" ? payload.verification.submittedAt : null);
      } catch {
        // ignore
      }
    })();
    return () => {
      canceled = true;
    };
  }, [sitterId]);

  const completionPercent = useMemo(() => {
    const effectiveProfile: HostProfileV1 = {
      ...profile,
      verificationStatus: verificationStatus === "approved" ? "verified" : profile.verificationStatus,
    };
    return getHostCompletion(effectiveProfile).percent;
  }, [profile, verificationStatus]);

  const canPublish = termsOk && completionPercent >= 100;

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

  async function persistProfile(nextProfile: HostProfileV1) {
    if (!sitterId) return;

    const normalized: HostProfileV1 = {
      ...nextProfile,
      sitterId,
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

  const activeServices = useMemo(
    () => (Object.keys(profile.services) as ServiceType[]).filter((svc) => profile.services[svc]),
    [profile.services]
  );

  const pricingValid = useMemo(
    () => activeServices.every((svc) => typeof profile.pricing?.[svc] === "number"),
    [activeServices, profile.pricing]
  );

  const pricingRangeErrors = useMemo(() => {
    const errors: Partial<Record<ServiceType, string>> = {};
    for (const svc of activeServices) {
      const v = profile.pricing?.[svc];
      if (typeof v === "number") {
        const msg = getTariffRangeError(svc, v);
        if (msg) errors[svc] = msg;
      }
    }
    return errors;
  }, [activeServices, profile.pricing]);

  const pricingWithinRanges = useMemo(
    () => Object.keys(pricingRangeErrors).length === 0,
    [pricingRangeErrors]
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

    if (!pricingWithinRanges) {
      const first = (Object.keys(pricingRangeErrors) as ServiceType[]).find((k) => Boolean(pricingRangeErrors[k]));
      setError(first ? pricingRangeErrors[first] ?? "Tarifs hors fourchettes autorisées." : "Tarifs hors fourchettes autorisées.");
      return;
    }

    if (!sitterId) return;
    const nextProfile: HostProfileV1 = {
      ...profile,
      sitterId,
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
        const payload = (await res.json()) as { ok?: boolean; error?: string; details?: string; profile?: unknown };
        if (!res.ok || !payload.ok || !payload.profile) {
          if (typeof payload?.details === "string" && payload.details.trim()) {
            setError(payload.details.trim());
          } else {
            setError(payload?.error ? `Impossible d’enregistrer le profil (${payload.error}).` : "Impossible d’enregistrer le profil.");
          }
          setSaved(false);
          return;
        }

        setSaved(true);
      } catch {
        setError("Impossible d’enregistrer le profil.");
        setSaved(false);
      }
    })();
  }

  if (!sitterId) {
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
                Profil {completionPercent}%
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
                    <Image
                      src={profile.avatarDataUrl}
                      alt="Aperçu"
                      width={64}
                      height={64}
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
                <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Encadrement tarifaire – Phase pilote</p>
                  <p className="mt-2 text-sm text-slate-700">
                    Dans le cadre de la phase pilote DogShift, les tarifs sont encadrés afin de garantir une cohérence du marché et d’éviter toute concurrence
                    déloyale. Les prix doivent respecter les fourchettes définies par la plateforme.
                  </p>
                </div>
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
                    const range = TARIFF_RANGES[svc];
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

                        {enabled && range ? (
                          <p className="mt-2 text-xs text-slate-600">Fourchette pilote : {range.min}–{range.max} CHF</p>
                        ) : null}

                        {enabled && typeof current === "number" && pricingRangeErrors[svc] ? (
                          <p className="mt-2 text-xs font-medium text-rose-600">{pricingRangeErrors[svc]}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {!pricingValid && activeServices.length > 0 ? (
                  <p className="mt-3 text-sm font-medium text-rose-600">Prix manquant pour un service activé.</p>
                ) : null}

                {!pricingWithinRanges ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-semibold text-rose-700">Tarifs hors fourchettes autorisées</p>
                    <div className="mt-2 space-y-1 text-sm text-rose-700">
                      {(Object.keys(pricingRangeErrors) as ServiceType[])
                        .filter((svc) => Boolean(pricingRangeErrors[svc]))
                        .map((svc) => (
                          <p key={svc}>{pricingRangeErrors[svc]}</p>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div id="disponibilites" className="scroll-mt-24 border-t border-slate-200 p-6 sm:p-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Disponibilités</h2>
                    <p className="mt-1 text-sm text-slate-600">Clique sur une date pour la rendre disponible / indisponible.</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">Ces disponibilités sont globales (un seul calendrier par sitter).</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (availLoading) return;
                      setAvailLoading(true);
                      setAvailError(null);
                      setAvailSaved(false);
                      try {
                        const res = await fetch("/api/sitter/availability", { method: "GET" });
                        const payload = (await res.json().catch(() => null)) as AvailabilityPayload | null;
                        if (!res.ok || !payload?.ok) {
                          setAvailError("Impossible de charger les disponibilités.");
                          return;
                        }
                        const rows = Array.isArray(payload.dates) ? payload.dates.filter((d): d is string => typeof d === "string") : [];
                        const normalized = new Set(rows);
                        setAvailRemote(normalized);
                        setAvailDraft(new Set(rows));
                      } catch {
                        setAvailError("Impossible de charger les disponibilités.");
                      } finally {
                        setAvailLoading(false);
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                  >
                    {availLoading ? "Chargement…" : "Rafraîchir"}
                  </button>
                </div>

                <div className="mt-5 rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setAvailMonth((m) => addMonths(m, -1))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                      aria-label="Mois précédent"
                    >
                      <span aria-hidden="true">‹</span>
                    </button>

                    <p className="text-sm font-semibold capitalize tracking-tight text-slate-900 sm:text-base">{monthTitle(availMonth)}</p>

                    <button
                      type="button"
                      onClick={() => setAvailMonth((m) => addMonths(m, 1))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                      aria-label="Mois suivant"
                    >
                      <span aria-hidden="true">›</span>
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-7 gap-1">
                    {(["L", "M", "M", "J", "V", "S", "D"] as const).map((d) => (
                      <p key={d} className="text-center text-[11px] font-semibold text-slate-500">
                        {d}
                      </p>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {getMonthGrid(availMonth).map((cell) => {
                      const iso = toIsoDateString(cell.date);
                      const isPast = iso < todayIso;
                      const selected = availDraft.has(iso);
                      const canToggle = cell.inMonth && !isPast;
                      return (
                        <button
                          key={iso}
                          type="button"
                          disabled={!canToggle}
                          onClick={() => {
                            if (!canToggle) return;
                            setAvailSaved(false);
                            setAvailDraft((prev) => {
                              const next = new Set(prev);
                              if (next.has(iso)) next.delete(iso);
                              else next.add(iso);
                              return next;
                            });
                          }}
                          className={
                            "inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] " +
                            (cell.inMonth ? "" : "opacity-40 ") +
                            (isPast ? "cursor-not-allowed bg-slate-100 text-slate-400 " : "") +
                            (selected && !isPast
                              ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
                              : !isPast
                                ? "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
                                : "")
                          }
                          aria-pressed={selected}
                        >
                          {cell.date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs font-medium text-slate-600">
                      <p>
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300 align-middle" /> <span className="ml-2">Disponible</span>
                      </p>
                      <p className="mt-1">
                        <span className="inline-flex h-2 w-2 rounded-full bg-slate-300 align-middle" /> <span className="ml-2">Indisponible</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={availSaving}
                      onClick={async () => {
                        if (availSaving) return;
                        setAvailSaving(true);
                        setAvailError(null);
                        setAvailSaved(false);
                        try {
                          const next = availDraft;
                          const toAdd = Array.from(next).filter((d) => !availRemote.has(d));
                          const toRemove = Array.from(availRemote).filter((d) => !next.has(d));

                          if (toAdd.length) {
                            const res = await fetch("/api/sitter/availability", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ dates: toAdd }),
                            });
                            const payload = (await res.json().catch(() => null)) as AvailabilityPayload | null;
                            if (!res.ok || !payload?.ok) {
                              setAvailError("Impossible d’enregistrer les disponibilités.");
                              return;
                            }
                          }

                          if (toRemove.length) {
                            const res = await fetch("/api/sitter/availability", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ dates: toRemove }),
                            });
                            const payload = (await res.json().catch(() => null)) as AvailabilityPayload | null;
                            if (!res.ok || !payload?.ok) {
                              setAvailError("Impossible d’enregistrer les disponibilités.");
                              return;
                            }
                          }

                          setAvailRemote(new Set(next));
                          setAvailSaved(true);
                        } catch {
                          setAvailError("Impossible d’enregistrer les disponibilités.");
                        } finally {
                          setAvailSaving(false);
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {availSaving ? "Enregistrement…" : "Enregistrer"}
                    </button>
                  </div>

                  {availSaved ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-semibold text-emerald-900">Enregistré</p>
                      <p className="mt-1 text-sm text-emerald-900/80">Tes disponibilités ont été mises à jour.</p>
                    </div>
                  ) : null}

                  {availError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <p className="text-sm font-semibold text-rose-900">Erreur</p>
                      <p className="mt-1 text-sm text-rose-900/80">{availError}</p>
                    </div>
                  ) : null}
                </div>
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
                    {!canPublish ? (
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        Complète ton profil et accepte le règlement pour publier.
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canPublish) return;
                      setPublished((v) => !v);
                    }}
                    disabled={!canPublish}
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
                  {verificationStatus === "approved" ? (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-semibold text-emerald-900">Vérifié</p>
                      <p className="mt-1 text-sm text-emerald-900/80">Votre profil est vérifié.</p>
                      <p className="mt-2 text-xs text-emerald-900/70">Nouvelle demande désactivée.</p>
                    </div>
                  ) : verificationStatus === "pending" ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">Vérification en cours</p>
                      <p className="mt-1 text-sm text-amber-900/80">Votre demande est en cours de vérification.</p>
                      {verificationSubmittedAt ? (
                        <p className="mt-2 text-xs font-medium text-amber-900/70">Soumise le {new Date(verificationSubmittedAt).toLocaleString()}</p>
                      ) : null}
                      <button
                        type="button"
                        disabled={verificationUploading}
                        onClick={async () => {
                          setVerificationError(null);
                          setVerificationUploading(true);
                          try {
                            const res = await fetch("/api/host/verification/delete", { method: "POST" });
                            const payload = (await res.json().catch(() => null)) as any;
                            if (!res.ok || !payload?.ok) {
                              setVerificationError("Impossible de supprimer la demande.");
                              return;
                            }
                            setVerificationStatus("not_verified");
                            setVerificationNotes(null);
                            setVerificationIdFileName(null);
                            setVerificationSelfieFileName(null);
                            setVerificationIdFile(null);
                            setVerificationSelfieFile(null);
                          } finally {
                            setVerificationUploading(false);
                          }
                        }}
                        className="mt-4 inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-white px-5 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Supprimer ma demande
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-600">Demandez la vérification pour rassurer les clients.</p>

                      {verificationStatus === "rejected" ? (
                        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                          <p className="text-sm font-semibold text-rose-900">Demande refusée</p>
                          <p className="mt-1 text-sm text-rose-900/80">Vous pouvez soumettre une nouvelle demande.</p>
                          {verificationNotes ? <p className="mt-2 text-xs text-rose-900/70">Notes: {verificationNotes}</p> : null}
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-700">Pièce d’identité (obligatoire)</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <input
                              id="host_verification_id"
                              type="file"
                              accept="image/jpeg,image/png,application/pdf"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setVerificationError(null);
                                setVerificationIdFileName(file ? file.name : null);
                                setVerificationIdFile(file);
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
                          <p className="mt-2 text-xs text-slate-500">JPG/PNG/PDF • max 5MB</p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-700">Selfie (recommandé)</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <input
                              id="host_verification_selfie"
                              type="file"
                              accept="image/jpeg,image/png"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setVerificationError(null);
                                setVerificationSelfieFileName(file ? file.name : null);
                                setVerificationSelfieFile(file);
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
                          <p className="mt-2 text-xs text-slate-500">JPG/PNG • max 5MB</p>
                        </div>
                      </div>

                      {verificationError ? <p className="mt-3 text-sm font-medium text-rose-600">{verificationError}</p> : null}

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          disabled={verificationUploading}
                          onClick={async () => {
                            if (!verificationIdFile) {
                              setVerificationError("Ajoutez votre pièce d’identité pour demander la vérification.");
                              return;
                            }
                            if (verificationIdFile.size > 5 * 1024 * 1024) {
                              setVerificationError("Fichier trop volumineux (max 5MB).");
                              return;
                            }
                            if (verificationSelfieFile && verificationSelfieFile.size > 5 * 1024 * 1024) {
                              setVerificationError("Selfie trop volumineux (max 5MB).");
                              return;
                            }

                            setVerificationUploading(true);
                            setVerificationError(null);
                            try {
                              const presignIdRes = await fetch("/api/host/verification/presign", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  kind: "id",
                                  contentType: verificationIdFile.type,
                                  sizeBytes: verificationIdFile.size,
                                }),
                              });
                              const presignId = (await presignIdRes.json().catch(() => null)) as any;
                              if (!presignIdRes.ok || !presignId?.ok || !presignId?.uploadUrl || !presignId?.key) {
                                setVerificationError("Impossible de préparer l’upload du document.");
                                return;
                              }

                              const putIdRes = await fetch(String(presignId.uploadUrl), {
                                method: "PUT",
                                headers: { "Content-Type": verificationIdFile.type },
                                body: verificationIdFile,
                              });
                              if (!putIdRes.ok) {
                                setVerificationError("Upload du document refusé.");
                                return;
                              }

                              let selfieKey: string | null = null;
                              if (verificationSelfieFile) {
                                const presignSelfieRes = await fetch("/api/host/verification/presign", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    kind: "selfie",
                                    contentType: verificationSelfieFile.type,
                                    sizeBytes: verificationSelfieFile.size,
                                  }),
                                });
                                const presignSelfie = (await presignSelfieRes.json().catch(() => null)) as any;
                                if (!presignSelfieRes.ok || !presignSelfie?.ok || !presignSelfie?.uploadUrl || !presignSelfie?.key) {
                                  setVerificationError("Impossible de préparer l’upload du selfie.");
                                  return;
                                }
                                const putSelfieRes = await fetch(String(presignSelfie.uploadUrl), {
                                  method: "PUT",
                                  headers: { "Content-Type": verificationSelfieFile.type },
                                  body: verificationSelfieFile,
                                });
                                if (!putSelfieRes.ok) {
                                  setVerificationError("Upload du selfie refusé.");
                                  return;
                                }
                                selfieKey = String(presignSelfie.key);
                              }

                              const submitRes = await fetch("/api/host/verification/submit", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  idDocumentKey: String(presignId.key),
                                  selfieKey,
                                }),
                              });
                              const submitPayload = (await submitRes.json().catch(() => null)) as any;
                              if (!submitRes.ok || !submitPayload?.ok) {
                                setVerificationError("Impossible de soumettre la demande.");
                                return;
                              }

                              setVerificationStatus("pending");
                              setVerificationNotes(null);
                              setVerificationSubmittedAt(new Date().toISOString());
                            } catch {
                              setVerificationError("Impossible de soumettre la demande.");
                            } finally {
                              setVerificationUploading(false);
                            }
                          }}
                          className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {verificationUploading ? "Envoi…" : "Demander la vérification"}
                        </button>

                        <p className="text-xs text-slate-500 sm:max-w-[360px]">
                          DogShift effectue un contrôle visuel des documents. Cette vérification ne constitue pas une authentification officielle.
                        </p>

                        <button
                          type="button"
                          disabled={verificationUploading}
                          onClick={async () => {
                            setVerificationError(null);
                            setVerificationUploading(true);
                            try {
                              const res = await fetch("/api/host/verification/delete", { method: "POST" });
                              const payload = (await res.json().catch(() => null)) as any;
                              if (!res.ok || !payload?.ok) {
                                setVerificationError("Impossible de supprimer les documents.");
                                return;
                              }
                              setVerificationStatus("not_verified");
                              setVerificationNotes(null);
                              setVerificationIdFileName(null);
                              setVerificationSelfieFileName(null);
                              setVerificationIdFile(null);
                              setVerificationSelfieFile(null);
                              setVerificationSubmittedAt(null);
                            } finally {
                              setVerificationUploading(false);
                            }
                          }}
                          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Supprimer mes documents
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={activeServices.length === 0 || !pricingValid || !pricingWithinRanges}
                  onClick={onSave}
                  className="mt-5 w-full rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
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
