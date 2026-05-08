/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Pencil, ShieldCheck, Clock, Camera, AlertTriangle, CheckCircle, XCircle, Upload } from "lucide-react";

import { useHostUser } from "@/components/HostUserProvider";
import { isActivatedStatus } from "@/lib/sitterContract";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

import type { DogSize } from "@/lib/mockSitters";
import {
  getDefaultHostProfile,
  getHostCompletion,
  loadHostProfileFromStorage,
  saveHostProfileToStorage,
  type HostProfileV1,
} from "@/lib/hostProfile";
import { SizeAcceptanceToggle } from "@/components/capacity/SizeAcceptanceToggle";
import { CapacitySlider } from "@/components/capacity/CapacitySlider";
import { CapacityScenariosVisualizer } from "@/components/capacity/CapacityScenariosVisualizer";
import { SizeWeightLegend } from "@/components/capacity/SizeWeightLegend";
import { DOG_SIZE_WEIGHTS } from "@/lib/constants/dog-sizes";

export default function HostProfileEditPage() {
  const host = useHostUser();
  const { sitterId, profile: remoteProfile, published: remotePublished, termsAcceptedAt, termsVersion, lifecycleStatus } = host;

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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [verificationIdFileName, setVerificationIdFileName] = useState<string | null>(null);
  const [verificationSelfieFileName, setVerificationSelfieFileName] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"not_verified" | "pending" | "approved" | "rejected">(
    (host.verificationStatus === "approved" || host.verificationStatus === "pending" || host.verificationStatus === "rejected")
      ? host.verificationStatus
      : "not_verified"
  );
  const [verificationNotes, setVerificationNotes] = useState<string | null>(null);
  const [verificationIdFile, setVerificationIdFile] = useState<File | null>(null);
  const [verificationSelfieFile, setVerificationSelfieFile] = useState<File | null>(null);
  const [verificationUploading, setVerificationUploading] = useState(false);
  const [verificationSubmittedAt, setVerificationSubmittedAt] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presentationTipsOpen, setPresentationTipsOpen] = useState(false);
  const presentationTipsRef = useRef<HTMLDivElement | null>(null);

  const [pensionVerifStatus, setPensionVerifStatus] = useState<string>("not_submitted");
  const [hasPension, setHasPension] = useState(false);
  const [pensionAcceptedSizes, setPensionAcceptedSizes] = useState<string[] | null>(null);
  const [pensionPhotoKeys, setPensionPhotoKeys] = useState<string[]>([]);
  const [pensionExifData, setPensionExifData] = useState<Record<string, unknown>[]>([]);
  const [pensionSubmitting, setPensionSubmitting] = useState(false);
  const [pensionResetting, setPensionResetting] = useState(false);
  const [pensionUploadingCount, setPensionUploadingCount] = useState(0);
  const [pensionError, setPensionError] = useState<string | null>(null);
  const pensionPhotoInputRef = useRef<HTMLInputElement>(null);

  // Max-dogs OPAn certificate state
  const [maxDogsCertStatus, setMaxDogsCertStatus] = useState<string>("not_submitted");
  const [maxDogsCertUploading, setMaxDogsCertUploading] = useState(false);
  const [maxDogsCertResetting, setMaxDogsCertResetting] = useState(false);
  const [maxDogsCertError, setMaxDogsCertError] = useState<string | null>(null);
  const [maxDogsCertSubmitting, setMaxDogsCertSubmitting] = useState(false);
  const [maxDogsCertKey, setMaxDogsCertKey] = useState<string | null>(null);
  const maxDogsCertInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!presentationTipsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresentationTipsOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const el = presentationTipsRef.current;
      if (!el || !(e.target instanceof Node) || el.contains(e.target)) return;
      setPresentationTipsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [presentationTipsOpen]);

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
    void fetchPensionStatus();
    void fetchMaxDogsCertStatus();
    return () => {
      canceled = true;
    };
  }, [sitterId]);

  const completionPercent = useMemo(() => {
    return getHostCompletion({ ...profile, stripeAccountStatus: host.stripeAccountStatus }).percent;
  }, [profile, host.stripeAccountStatus]);

  const canPublish = termsOk && completionPercent >= 100 && isActivatedStatus(lifecycleStatus);
  const canTogglePublish = published || canPublish;

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

  async function fetchPensionStatus() {
    try {
      const res = await fetch("/api/host/pension-verification");
      const data = await res.json();
      if (data.ok) {
        setPensionVerifStatus(data.status ?? "not_submitted");
        setHasPension(Boolean(data.hasPension));
        setPensionAcceptedSizes(Array.isArray(data.pensionAcceptedSizes) ? data.pensionAcceptedSizes : null);
      }
    } catch { /* ignore */ }
  }

  async function fetchMaxDogsCertStatus() {
    try {
      const res = await fetch("/api/host/max-dogs-cert");
      const data = await res.json();
      if (data.ok) {
        setMaxDogsCertStatus(data.status ?? "not_submitted");
      }
    } catch { /* ignore */ }
  }

  async function handleMaxDogsCertFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMaxDogsCertError(null);
    setMaxDogsCertUploading(true);
    try {
      const presignRes = await fetch("/api/host/max-dogs-cert/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok || !presignData.ok) {
        setMaxDogsCertError("Impossible de préparer l'envoi. Réessayez.");
        return;
      }
      await fetch(presignData.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setMaxDogsCertKey(presignData.key);
    } catch {
      setMaxDogsCertError("Erreur lors de l'upload. Réessayez.");
    } finally {
      setMaxDogsCertUploading(false);
      if (maxDogsCertInputRef.current) maxDogsCertInputRef.current.value = "";
    }
  }

  async function submitMaxDogsCert() {
    if (!maxDogsCertKey) { setMaxDogsCertError("Veuillez d'abord télécharger votre document."); return; }
    setMaxDogsCertSubmitting(true);
    setMaxDogsCertError(null);
    try {
      const res = await fetch("/api/host/max-dogs-cert/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoKey: maxDogsCertKey }),
      });
      const data = await res.json();
      if (data.ok) {
        setMaxDogsCertKey(null);
        await fetchMaxDogsCertStatus();
      } else {
        setMaxDogsCertError("Erreur lors de la soumission. Réessayez.");
      }
    } catch {
      setMaxDogsCertError("Erreur réseau. Réessayez.");
    } finally {
      setMaxDogsCertSubmitting(false);
    }
  }

  async function resetMaxDogsCert() {
    setMaxDogsCertResetting(true);
    try {
      const res = await fetch("/api/host/max-dogs-cert/reset", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMaxDogsCertKey(null);
        await fetchMaxDogsCertStatus();
      }
    } catch { /* ignore */ } finally {
      setMaxDogsCertResetting(false);
    }
  }

  async function handlePensionPhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 8 - pensionPhotoKeys.length;
    const toUpload = files.slice(0, remaining);
    setPensionUploadingCount(toUpload.length);
    setPensionError(null);
    for (const file of toUpload) {
      try {
        // Extract EXIF metadata before upload
        let exif: Record<string, unknown> = {};
        try {
          const { default: exifr } = await import("exifr");
          const raw = await exifr.parse(file, {
            pick: ["Make", "Model", "DateTimeOriginal", "CreateDate", "GPSLatitude", "GPSLongitude", "Software", "Orientation"],
          });
          if (raw && typeof raw === "object") exif = raw as Record<string, unknown>;
        } catch { /* EXIF unavailable, continue */ }
        setPensionExifData((prev) => [...prev, exif]);

        const presignRes = await fetch("/api/host/pension-verification/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
        });
        const presignData = await presignRes.json();
        if (!presignData.ok || !presignData.uploadUrl) {
          setPensionError("Erreur upload. Réessaie.");
          setPensionUploadingCount((prev) => Math.max(0, prev - 1));
          continue;
        }
        await fetch(presignData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        setPensionPhotoKeys((prev) => [...prev, presignData.key]);
      } catch {
        setPensionError("Erreur upload.");
      }
      setPensionUploadingCount((prev) => Math.max(0, prev - 1));
    }
    if (pensionPhotoInputRef.current) pensionPhotoInputRef.current.value = "";
  }

  async function submitPensionVerification() {
    if (pensionPhotoKeys.length < 3) { setPensionError("Minimum 3 photos requises."); return; }
    if (!profile.boardingDetails?.housingType) { setPensionError("Veuillez d'abord sélectionner le type de logement."); return; }
    setPensionSubmitting(true);
    setPensionError(null);
    try {
      const res = await fetch("/api/host/pension-verification/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoKeys: pensionPhotoKeys, exifData: pensionExifData }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setPensionError(data.error ?? "Erreur serveur."); return; }
      setPensionVerifStatus("pending");
      setPensionPhotoKeys([]);
      setPensionExifData([]);
    } finally {
      setPensionSubmitting(false);
    }
  }

  async function resetPensionVerification() {
    setPensionResetting(true);
    try {
      const res = await fetch("/api/host/pension-verification/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      setPensionVerifStatus("not_submitted");
      setPensionPhotoKeys([]);
      setPensionExifData([]);
      setPensionError(null);
    } finally {
      setPensionResetting(false);
    }
  }

  async function uploadHostAvatar(file: File) {
    if (!sitterId) return;
    setError(null);
    setAvatarUploading(true);
    try {
      const rawType = (file.type || "").toLowerCase();
      const contentType =
        rawType === "image/png" ? "image/png" : rawType === "image/webp" ? "image/webp" : "image/jpeg";

      const presRes = await fetch("/api/host/profile/avatar/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, sizeBytes: file.size }),
      });
      const pres = (await presRes.json().catch(() => null)) as {
        ok?: boolean;
        uploadUrl?: string;
        key?: string;
        error?: string;
      };
      if (!presRes.ok || !pres?.ok || !pres.uploadUrl || !pres.key) {
        setError(
          pres?.error === "FILE_TOO_LARGE"
            ? "Ce fichier est trop volumineux (max. 12 Mo)."
            : "Impossible de préparer l'envoi de la photo. Réessaie ou choisis une autre image.",
        );
        return;
      }

      const putRes = await fetch(String(pres.uploadUrl), {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!putRes.ok) {
        setError("Échec du transfert de la photo. Réessaie.");
        return;
      }

      const commitRes = await fetch("/api/host/profile/avatar/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: pres.key }),
      });
      const commit = (await commitRes.json().catch(() => null)) as { ok?: boolean; avatarUrl?: string };
      if (!commitRes.ok || !commit?.ok || typeof commit.avatarUrl !== "string") {
        setError("Impossible d'enregistrer la photo. Réessaie.");
        return;
      }

      setAvatarFileName(file.name);
      setProfile((p) => {
        const next: HostProfileV1 = {
          ...p,
          avatarDataUrl: undefined,
          avatarUrl: commit.avatarUrl,
          updatedAt: new Date().toISOString(),
        };
        saveHostProfileToStorage(next);
        return next;
      });
    } catch {
      setError("Impossible d'envoyer la photo. Vérifie ta connexion et réessaie.");
    } finally {
      setAvatarUploading(false);
    }
  }

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

  function onSave() {
    setSaved(false);
    setError(null);

    if (!sitterId) return;
    const nextProfile: HostProfileV1 = {
      ...profile,
      sitterId,
      profileVersion: 1,
      updatedAt: new Date().toISOString(),
    };
    setProfile(nextProfile);
    saveHostProfileToStorage(nextProfile);

    setSaving(true);

    void (async () => {
      try {
        const res = await fetch("/api/host/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...nextProfile, published }),
        });
        const payload = (await res.json()) as { ok?: boolean; error?: string; details?: string; profile?: unknown; published?: boolean; profileCompletion?: number; publishBlocked?: { error: string } | null };
        if (!res.ok || !payload.ok || !payload.profile) {
          if (typeof payload?.details === "string" && payload.details.trim()) {
            setError(payload.details.trim());
          } else {
            setError(payload?.error ? `Impossible d'enregistrer le profil (${payload.error}).` : "Impossible d'enregistrer le profil.");
          }
          setSaved(false);
          return;
        }

        if (payload.publishBlocked) {
          const msgs: Record<string, string> = {
            TERMS_NOT_ACCEPTED: "Accepte le règlement avant de publier ton annonce.",
            PROFILE_INCOMPLETE: "Complète ton profil à 100 % avant de publier.",
            CONTRACT_NOT_SIGNED: "Signe le contrat avant de publier ton annonce.",
            ACCOUNT_NOT_ACTIVATED: "Ton compte doit être activé pour publier.",
            CONTRACT_AMENDMENT_REQUIRED: "Un avenant au contrat doit être accepté avant de publier.",
          };
          setError(msgs[payload.publishBlocked.error] ?? "La publication a été bloquée.");
          setPublished(false);
        } else {
          if (typeof payload.published === "boolean" && payload.published !== published) {
            setPublished(payload.published);
          }
          if (payload.profile && typeof payload.profile === "object") {
            const serverProfile = payload.profile as Partial<HostProfileV1>;
            if (serverProfile.profileVersion === 1 && serverProfile.sitterId) {
              setProfile(serverProfile as HostProfileV1);
              saveHostProfileToStorage(serverProfile as HostProfileV1);
            }
          }
          setSaved(true);
        }
      } catch {
        setError("Impossible d'enregistrer le profil.");
        setSaved(false);
      } finally {
        setSaving(false);
      }
    })();
  }

  if (!sitterId) {
    return (
      <div className="relative grid gap-6 overflow-x-hidden" data-testid="host-profile-edit">
        <div className="relative z-10 rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Profil hôte</p>
          <p className="mt-2 text-sm text-slate-600">Ton profil hôte n&apos;est pas encore disponible.</p>
          <div className="mt-4">
            <Link href="/devenir-dogsitter" className="text-sm font-semibold text-[var(--dogshift-blue)]">
              Créer mon profil hôte
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid gap-6 overflow-x-hidden" data-testid="host-profile-edit">
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

        <div className="mt-8 grid gap-6">

          {/* ── Section 1 — Identité du profil public ── */}
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
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700" htmlFor="host_address">
                  Adresse complète (confidentielle)
                </label>
                <input
                  id="host_address"
                  value={profile.address ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                  placeholder="ex. Rue du Rhône 12, 1204 Genève"
                  autoComplete="street-address"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Renseigne ton adresse pour activer l&apos;option &laquo;&nbsp;Le sitter se déplace chez moi&nbsp;&raquo; lors des réservations. Elle n&apos;est jamais partagée publiquement.
                </p>
              </div>

              <div id="photo" className="scroll-mt-24 mt-5">
                <label className="block text-sm font-medium text-slate-700" htmlFor="host_photo">
                  Photo
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  JPG, PNG ou WebP — les photos du téléphone sont acceptées (téléversement sécurisé jusqu&apos;à 12&nbsp;Mo).
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    id="host_photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    className="sr-only"
                    disabled={avatarUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void uploadHostAvatar(file);
                      e.target.value = "";
                    }}
                  />
                  <label
                    htmlFor="host_photo"
                    className={
                      "inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50" +
                      (avatarUploading ? " pointer-events-none opacity-60" : "")
                    }
                  >
                    {avatarUploading ? "Envoi…" : "Choisir un fichier"}
                  </label>
                  <p className="text-xs font-medium text-slate-600">
                    {avatarUploading
                      ? "Téléversement en cours…"
                      : avatarFileName
                        ? avatarFileName
                        : profile.avatarDataUrl || profile.avatarUrl
                          ? "Photo enregistrée"
                          : "Aucun fichier choisi"}
                  </p>
                </div>
                {profile.avatarDataUrl || profile.avatarUrl ? (
                  <Image
                    src={profile.avatarDataUrl || profile.avatarUrl || ""}
                    alt="Aperçu"
                    width={64}
                    height={64}
                    unoptimized={Boolean(profile.avatarDataUrl)}
                    className="mt-3 h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
                  />
                ) : null}
              </div>
            </div>
          </section>

          {/* ── Section 2 — Présentation ── */}
          <section className="relative rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <div id="description" className="scroll-mt-24 p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <h2 className="text-base font-semibold text-slate-900">Présentation</h2>
                  <div
                    ref={presentationTipsRef}
                    className="relative shrink-0"
                    onMouseEnter={() => {
                      if (typeof window === "undefined") return;
                      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                        setPresentationTipsOpen(true);
                      }
                    }}
                    onMouseLeave={() => {
                      if (typeof window === "undefined") return;
                      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                        setPresentationTipsOpen(false);
                      }
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={presentationTipsOpen}
                      aria-controls="presentation-help-popover"
                      onClick={() => setPresentationTipsOpen((v) => !v)}
                      className="inline-flex rounded-lg p-0.5 text-slate-400 outline-none transition hover:text-slate-500 focus-visible:ring-2 focus-visible:ring-[var(--dogshift-blue)] focus-visible:ring-offset-2"
                    >
                      <span className="sr-only">Conseils pour rédiger votre présentation</span>
                      <Info className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                    </button>
                    {presentationTipsOpen ? (
                      <div className="absolute left-0 top-full z-20 pt-2" role="presentation">
                        <div
                          id="presentation-help-popover"
                          role="region"
                          aria-label="Conseils pour la présentation"
                          className="w-[min(calc(100vw-2rem),400px)] max-w-[400px] rounded-xl border border-slate-200/90 bg-white p-5 text-sm leading-relaxed text-slate-600 shadow-lg shadow-slate-900/10"
                        >
                          <p className="text-slate-700">Décris ton expérience et ton approche avec les chiens.</p>
                          <p className="mt-2.5 text-slate-600">Précise par exemple :</p>
                          <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                            <ul className="list-disc space-y-1.5 pl-4 text-slate-500 marker:text-slate-400">
                              <li>types de chiens acceptés (âge, taille, caractère)</li>
                              <li>expérience (promenades, garde, pension)</li>
                            </ul>
                            <ul className="list-disc space-y-1.5 pl-4 text-slate-500 marker:text-slate-400">
                              <li>environnement (appartement, maison, jardin)</li>
                              <li>habitudes (sorties, présence à domicile)</li>
                            </ul>
                          </div>
                          <p className="mt-3 text-slate-700">
                            Une description claire inspire confiance et augmente tes chances de recevoir des demandes.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 text-xs font-semibold text-slate-500">{profile.bio.length} caractères</p>
              </div>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                className="mt-4 w-full min-h-[140px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                placeholder="Décrivez votre expérience, votre approche et comment vous prenez soin des chiens."
              />
            </div>
          </section>

          {/* ── Section 3 — Critères d'acceptation des chiens ── */}
          <section className="relative rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <div id="acceptanceCriteria" className="scroll-mt-24 p-6 sm:p-8">
              <h2 className="text-base font-semibold text-slate-900">Critères d&apos;acceptation des chiens</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ces critères s&apos;appliquent à tous vos services. Les réservations qui ne les respectent pas seront automatiquement bloquées.
              </p>

              {/* 3a — Tailles acceptées (toggle ON/OFF) */}
              <div id="dogSizes" className="scroll-mt-24 mt-6">
                <h3 className="text-sm font-semibold text-slate-800">Tailles acceptées</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Sélectionnez les tailles de chiens que vous acceptez. Chaque taille occupe un nombre de places différent dans votre capacité.
                </p>

                {pensionVerifStatus === "approved" && pensionAcceptedSizes && pensionAcceptedSizes.length > 0 && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                    <div>
                      <p className="text-xs font-semibold text-amber-900">Tailles autorisées par DogShift pour la Pension</p>
                      <p className="mt-0.5 text-xs text-amber-700">
                        Suite à la vérification de votre logement, vous pouvez uniquement accueillir des chiens de taille&nbsp;:&nbsp;
                        <span className="font-bold">
                          {pensionAcceptedSizes
                            .map((s) => ({ small: "Petit", medium: "Moyen", large: "Grand" }[s] ?? s))
                            .join(", ")}
                        </span>.
                        Les autres tailles sont désactivées pour le service Pension.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <SizeAcceptanceToggle
                    accepted={{
                      small: profile.acceptsSmall ?? profile.dogSizes.Petit,
                      medium: profile.acceptsMedium ?? profile.dogSizes.Moyen,
                      large: profile.acceptsLarge ?? profile.dogSizes.Grand,
                    }}
                    disabledSizes={
                      pensionVerifStatus === "approved" && pensionAcceptedSizes && pensionAcceptedSizes.length > 0
                        ? {
                            small: !pensionAcceptedSizes.includes("small"),
                            medium: !pensionAcceptedSizes.includes("medium"),
                            large: !pensionAcceptedSizes.includes("large"),
                          }
                        : undefined
                    }
                    onChange={(next) =>
                      setProfile((p) => ({
                        ...p,
                        acceptsSmall: next.small,
                        acceptsMedium: next.medium,
                        acceptsLarge: next.large,
                        dogSizes: { Petit: next.small, Moyen: next.medium, Grand: next.large },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="my-6 border-t border-slate-100" />

              {/* 3b — Capacité d'accueil simultanée */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Capacité d&apos;accueil simultanée</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Combien de chiens peux-tu accueillir en même temps ? Chaque taille de chien occupe un nombre de places différent dans ta capacité, selon l&apos;espace et l&apos;attention nécessaires.
                </p>

                <div className="mt-3 mb-5">
                  <SizeWeightLegend />
                </div>

                <CapacitySlider
                  value={profile.capacityPlaces ?? 3}
                  onChange={(v) => setProfile((p) => ({ ...p, capacityPlaces: v }))}
                />

                <div className="mt-5">
                  <CapacityScenariosVisualizer
                    capacity={profile.capacityPlaces ?? 3}
                    accepted={{
                      small: profile.acceptsSmall ?? profile.dogSizes.Petit,
                      medium: profile.acceptsMedium ?? profile.dogSizes.Moyen,
                      large: profile.acceptsLarge ?? profile.dogSizes.Grand,
                    }}
                  />
                </div>

                {/* OPAn certificate required when equivalent maxDogs > 5 */}
                {(profile.capacityPlaces ?? 3) > 5 && (
                  <div className="mt-4">
                    {maxDogsCertStatus === "approved" ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">Certificat OPAn validé</p>
                          <p className="text-xs text-emerald-700 mt-0.5">Vous êtes autorisé(e) à accueillir plus de 5 chiens simultanément.</p>
                        </div>
                      </div>
                    ) : maxDogsCertStatus === "pending" ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 shrink-0 text-amber-600" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-amber-900">Document en cours de vérification</p>
                            <p className="text-xs text-amber-700 mt-0.5">Notre équipe examine votre document. Réponse sous 24–48h ouvrées.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void resetMaxDogsCert()}
                            disabled={maxDogsCertResetting}
                            className="shrink-0 text-xs text-amber-700 underline hover:text-amber-900 disabled:opacity-50"
                          >
                            {maxDogsCertResetting ? "…" : "Nouveau document"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className={`flex items-center gap-3 px-5 py-4 border-b ${maxDogsCertStatus === "rejected" ? "border-rose-100 bg-rose-50" : "border-slate-100 bg-slate-50"}`}>
                          <ShieldCheck className={`h-5 w-5 shrink-0 ${maxDogsCertStatus === "rejected" ? "text-rose-600" : "text-[var(--dogshift-blue)]"}`} />
                          <div>
                            <p className={`text-sm font-semibold ${maxDogsCertStatus === "rejected" ? "text-rose-900" : "text-slate-900"}`}>
                              {maxDogsCertStatus === "rejected" ? "Document refusé — soumettez-en un nouveau" : "Certificat OPAn requis (art. 101 OPAn)"}
                            </p>
                            <p className={`text-xs mt-0.5 ${maxDogsCertStatus === "rejected" ? "text-rose-700" : "text-slate-500"}`}>
                              La loi suisse exige une attestation FSIFP ou une autorisation cantonale pour garder plus de 5 chiens simultanément.
                            </p>
                          </div>
                        </div>
                        <div className="px-5 py-5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Document accepté</p>
                          <div className="grid grid-cols-1 gap-1.5 mb-4 sm:grid-cols-2 text-xs text-slate-600">
                            {["Attestation FSIFP (garde d'animaux de compagnie)", "Autorisation cantonale (SCAV/service vétérinaire)"].map((l) => (
                              <div key={l} className="flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                {l}
                              </div>
                            ))}
                          </div>
                          {maxDogsCertError && (
                            <div className="mb-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2">
                              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                              <span className="text-xs font-medium text-rose-700">{maxDogsCertError}</span>
                            </div>
                          )}
                          {maxDogsCertKey ? (
                            <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                              <span className="text-xs font-medium text-slate-700">Document prêt pour envoi</span>
                              <button type="button" onClick={() => setMaxDogsCertKey(null)} className="ml-auto text-xs text-slate-400 hover:text-slate-600">Effacer</button>
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => maxDogsCertInputRef.current?.click()}
                              disabled={maxDogsCertUploading}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              {maxDogsCertUploading ? "Upload…" : "Choisir un document"}
                            </button>
                            {maxDogsCertKey && (
                              <button
                                type="button"
                                onClick={() => void submitMaxDogsCert()}
                                disabled={maxDogsCertSubmitting}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--dogshift-blue)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:opacity-50"
                              >
                                {maxDogsCertSubmitting ? "Envoi…" : "Soumettre pour vérification"}
                              </button>
                            )}
                          </div>
                          <input
                            ref={maxDogsCertInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            onChange={(e) => void handleMaxDogsCertFileChange(e)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="my-6 border-t border-slate-100" />

              {/* 3c — Conditions sur le chien */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Conditions sur le chien</h3>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Chien castré/stérilisé requis</p>
                      <p className="mt-0.5 text-xs text-slate-500">Vous n&apos;acceptez que les chiens castrés ou stérilisés.</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Castration requise"
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          neuteredRequired: !p.neuteredRequired,
                          acceptanceCriteria: {
                            ...p.acceptanceCriteria,
                            neuteredRequired: !p.neuteredRequired,
                          },
                        }))
                      }
                      className={
                        profile.neuteredRequired
                          ? "inline-flex h-8 w-14 items-center rounded-full bg-[var(--dogshift-blue)] p-1 transition"
                          : "inline-flex h-8 w-14 items-center rounded-full bg-slate-200 p-1 transition"
                      }
                    >
                      <span
                        className={
                          profile.neuteredRequired
                            ? "h-6 w-6 translate-x-6 rounded-full bg-white shadow-sm transition"
                            : "h-6 w-6 translate-x-0 rounded-full bg-white shadow-sm transition"
                        }
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 4 — Logement (conditionnelle) ── */}
          <section className="relative rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <div className="p-6 sm:p-8">
              <h2 className="text-base font-semibold text-slate-900">Logement</h2>
              <p className="mt-1 text-sm text-slate-500">
                Informations sur votre logement, requises pour activer la Pension sur votre profil.
              </p>

              {hasPension ? (
                <div className="mt-5">
                  {pensionVerifStatus === "approved" ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-4">
                        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">Logement vérifié</p>
                          <p className="text-xs text-emerald-700 mt-0.5">Le service Pension est actif sur votre profil public.</p>
                        </div>
                      </div>
                      {pensionAcceptedSizes && pensionAcceptedSizes.length > 0 && (
                        <div className="border-t border-emerald-100 bg-emerald-50/60 px-5 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-2">
                            Tailles autorisées pour la Pension
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(["small", "medium", "large"] as const).map((key) => {
                              const allowed = pensionAcceptedSizes.includes(key);
                              const { label, range } = DOG_SIZE_WEIGHTS[key];
                              return (
                                <div
                                  key={key}
                                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                    allowed
                                      ? "bg-emerald-600 text-white"
                                      : "bg-emerald-100/60 text-emerald-400 line-through"
                                  }`}
                                >
                                  {label}
                                  <span className={`font-normal ${allowed ? "text-emerald-100" : "text-emerald-300"}`}>
                                    {range}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-2 text-[11px] text-emerald-600">
                            Ces tailles ont été déterminées lors de la vérification de votre logement. Contactez le support pour toute modification.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : pensionVerifStatus === "pending" || pensionVerifStatus === "ai_reviewing" || pensionVerifStatus === "ai_needs_review" ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 shrink-0 text-amber-600" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-900">Vérification en cours</p>
                          <p className="text-xs text-amber-700 mt-0.5">Notre équipe examine vos photos. Vous recevrez un e-mail de réponse dans les 24–48 heures ouvrées.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void resetPensionVerification()}
                          disabled={pensionResetting}
                          className="shrink-0 text-xs text-amber-700 underline hover:text-amber-900 disabled:opacity-50"
                        >
                          {pensionResetting ? "Réinitialisation…" : "Réessayer"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Single unified card: housing details + photo upload */
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      {/* Header */}
                      <div className={`flex items-center gap-3 px-5 py-4 border-b ${pensionVerifStatus === "ai_rejected" || pensionVerifStatus === "rejected" ? "border-rose-100 bg-rose-50" : "border-slate-100 bg-slate-50"}`}>
                        {pensionVerifStatus === "ai_rejected" || pensionVerifStatus === "rejected" ? (
                          <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
                        ) : (
                          <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--dogshift-blue)]" />
                        )}
                        <div>
                          <p className={`text-sm font-semibold ${pensionVerifStatus === "ai_rejected" || pensionVerifStatus === "rejected" ? "text-rose-900" : "text-slate-900"}`}>
                            {pensionVerifStatus === "ai_rejected" || pensionVerifStatus === "rejected"
                              ? "Photos refusées — Soumettez de nouvelles photos"
                              : "Vérification du logement requise"}
                          </p>
                          <p className={`text-xs mt-0.5 ${pensionVerifStatus === "ai_rejected" || pensionVerifStatus === "rejected" ? "text-rose-700" : "text-slate-500"}`}>
                            {pensionVerifStatus === "ai_rejected" || pensionVerifStatus === "rejected"
                              ? "Vos photos n&apos;ont pas satisfait les critères. Complétez les informations et soumettez de nouvelles photos."
                              : "Requis pour activer la Pension sur votre profil public."}
                          </p>
                        </div>
                      </div>

                      {/* Housing details — required before upload */}
                      <div className="px-5 py-5 border-b border-slate-100">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">Détails du logement</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-slate-700" htmlFor="host_housing">
                              Type de logement <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
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
                                className={`mt-2 w-full appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-medium shadow-sm outline-none transition focus:ring-4 ${
                                  !profile.boardingDetails?.housingType
                                    ? "border-amber-400 bg-amber-50 text-slate-900 focus:border-amber-500 focus:ring-amber-100"
                                    : "border-slate-300 bg-white text-slate-900 focus:border-[var(--dogshift-blue)] focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                                }`}
                              >
                                <option value="">Sélectionner</option>
                                <option value="Appartement">Appartement</option>
                                <option value="Maison">Maison</option>
                              </select>
                              <div className="pointer-events-none absolute right-4 top-[calc(50%+4px)] -translate-y-1/2 text-slate-400">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                            {!profile.boardingDetails?.housingType && (
                              <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Requis pour soumettre vos photos
                              </p>
                            )}
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
                          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 cursor-pointer">
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
                          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 cursor-pointer">
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

                      {/* Photo upload */}
                      <div className="px-5 py-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Photos requises (3 minimum, 8 maximum)</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-4">
                          {["Salon / séjour", "Chambre / espace nuit", "Cuisine", "Extérieur (si dispo)"].map((label) => (
                            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Camera className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              {label}
                            </div>
                          ))}
                        </div>

                        {pensionPhotoKeys.length > 0 && (
                          <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span className="text-xs font-medium text-slate-700">{pensionPhotoKeys.length} photo{pensionPhotoKeys.length > 1 ? "s" : ""} prête{pensionPhotoKeys.length > 1 ? "s" : ""} pour l&apos;envoi</span>
                            <button type="button" onClick={() => { setPensionPhotoKeys([]); setPensionExifData([]); }} className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition">
                              Effacer
                            </button>
                          </div>
                        )}
                        {pensionError && (
                          <div className="mb-3 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2">
                            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                            <span className="text-xs font-medium text-rose-700">{pensionError}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => pensionPhotoInputRef.current?.click()}
                            disabled={pensionUploadingCount > 0 || pensionPhotoKeys.length >= 8}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {pensionUploadingCount > 0 ? `Chargement (${pensionUploadingCount})…` : "Sélectionner des photos"}
                          </button>
                          {pensionPhotoKeys.length >= 3 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!profile.boardingDetails?.housingType) {
                                  setPensionError("Veuillez d'abord sélectionner le type de logement.");
                                  return;
                                }
                                void submitPensionVerification();
                              }}
                              disabled={pensionSubmitting || !profile.boardingDetails?.housingType}
                              title={!profile.boardingDetails?.housingType ? "Sélectionnez d'abord le type de logement" : undefined}
                              className="inline-flex items-center gap-2 rounded-xl bg-[var(--dogshift-blue)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {pensionSubmitting ? "Envoi en cours…" : "Soumettre pour vérification"}
                            </button>
                          )}
                        </div>
                        {pensionPhotoKeys.length >= 3 && !profile.boardingDetails?.housingType && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-amber-700">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Sélectionnez le type de logement pour pouvoir soumettre.
                          </p>
                        )}
                        <input
                          ref={pensionPhotoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => void handlePensionPhotoAdd(e)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm text-slate-600">
                    Activez le service Pension dans &quot;Services&quot; pour configurer votre logement.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ── Section 5 — Statut du compte ── */}
          <section className="relative rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <div className="p-6 sm:p-8">
              <h2 className="text-base font-semibold text-slate-900">Statut du compte</h2>

              {/* 5a — Vérification d'identité */}
              <div id="verification" className="scroll-mt-24 mt-5">
                <h3 className="text-sm font-semibold text-slate-800">Vérification d&apos;identité</h3>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5">
                  {verificationStatus === "approved" ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-semibold text-emerald-900">Vérifié</p>
                      <p className="mt-1 text-sm text-emerald-900/80">Votre profil est vérifié.</p>
                      <p className="mt-2 text-xs text-emerald-900/70">Nouvelle demande désactivée.</p>
                    </div>
                  ) : verificationStatus === "pending" ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
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
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                          <p className="text-xs font-semibold text-slate-700">Pièce d&apos;identité (obligatoire)</p>
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
                              setVerificationError("Ajoutez votre pièce d'identité pour demander la vérification.");
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
                                setVerificationError("Impossible de préparer l'upload du document.");
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
                                  setVerificationError("Impossible de préparer l'upload du selfie.");
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
              </div>

              <div className="my-6 border-t border-slate-100" />

              {/* 5b — Publication de l'annonce */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Publication de l&apos;annonce</h3>
                <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {published ? "Votre annonce est visible dans la recherche." : "Votre annonce est cachée (brouillon)."}
                    </p>
                    {!canPublish && !published ? (
                      <p className="mt-1.5 text-sm text-slate-500">
                        Complète ton profil et accepte le règlement pour publier.
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canTogglePublish) return;
                      setPublished((v) => !v);
                    }}
                    disabled={!canTogglePublish}
                    className={`inline-flex h-9 w-14 shrink-0 items-center rounded-full p-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      published ? "bg-[var(--dogshift-blue)]" : "bg-slate-200"
                    }`}
                    aria-label={published ? "Désactiver la publication de l'annonce" : "Activer la publication de l'annonce"}
                    aria-checked={published}
                    role="switch"
                  >
                    <span
                      className={`h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${
                        published ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Bouton Enregistrer ── */}
          <div>
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  <span>Enregistrement…</span>
                </>
              ) : (
                "Enregistrer"
              )}
            </button>

            {saved ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Enregistré</p>
                <p className="mt-1 text-sm text-emerald-900/80">Vos modifications seront visibles sur votre profil public.</p>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
          </div>

        </div>
      </div>
    </div>
  );
}
