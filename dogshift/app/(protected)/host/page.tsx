"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useUser } from "@clerk/nextjs";

import SunCornerGlow from "@/components/SunCornerGlow";
import { useHostUser } from "@/components/HostUserProvider";
import PageLoader from "@/components/ui/PageLoader";

import { getSitterById } from "@/lib/mockSitters";
import { loadReviewsFromStorage, type DogShiftReview } from "@/lib/reviews";
import { getUnreadHostMessageCount } from "@/lib/hostMessages";
import {
  getDefaultHostProfile,
  getHostCompletion,
  getHostTodos,
  loadHostProfileFromStorage,
  type HostProfileV1,
} from "@/lib/hostProfile";
import { loadHostBookings, loadHostRequestStatus } from "@/lib/hostBookings";

type AvailabilityPayload = { ok?: boolean; dates?: string[]; error?: string };

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

function parseIsoDateString(value: string) {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
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

function formatRating(rating: number) {
  return rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
}

const HOST_COMPLETION_CARD_DISMISSED_KEY = "ds_host_completion_card_dismissed_v1";
const HOST_COMPLETION_CARD_DISMISSED_EVENT = "ds_host_completion_card_dismissed";

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.366 2.447a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.447a1 1 0 00-1.176 0l-3.366 2.447c-.784.57-1.838-.197-1.54-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.102 9.384c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

function FilledSunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="18" fill="#fbbf24" />
      <polygon points="32,4 26,16 38,16" fill="#fbbf24" />
      <polygon points="32,60 26,48 38,48" fill="#fbbf24" />
      <polygon points="4,32 16,26 16,38" fill="#fbbf24" />
      <polygon points="60,32 48,26 48,38" fill="#fbbf24" />
      <polygon points="12,12 22,18 18,22" fill="#fbbf24" />
      <polygon points="52,12 46,22 42,18" fill="#fbbf24" />
      <polygon points="12,52 18,42 22,46" fill="#fbbf24" />
      <polygon points="52,52 42,46 46,42" fill="#fbbf24" />
    </svg>
  );
}

function StatusBadge({ status }: { status: "verified" | "pending" | "unverified" }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
        Vérifié
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm">
        En cours
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      Non vérifié
    </span>
  );
}

function HostAvatar({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return null;
  }

  return (
    <Image src={src} alt={alt} width={56} height={56} className="h-14 w-14 rounded-full border border-slate-200 object-cover" />
  );
}

export default function HostDashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { sitterId, profile: remoteProfile } = useHostUser();
  const [unreadTick, setUnreadTick] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<"not_verified" | "pending" | "approved" | "rejected">(
    "not_verified"
  );

  const completionCardDismissed = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};

      const onCustom = () => onStoreChange();
      window.addEventListener(HOST_COMPLETION_CARD_DISMISSED_EVENT, onCustom);

      const onStorage = (e: StorageEvent) => {
        if (e.key === HOST_COMPLETION_CARD_DISMISSED_KEY) {
          onStoreChange();
        }
      };
      window.addEventListener("storage", onStorage);

      return () => {
        window.removeEventListener(HOST_COMPLETION_CARD_DISMISSED_EVENT, onCustom);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(HOST_COMPLETION_CARD_DISMISSED_KEY) === "1";
      } catch {
        return false;
      }
    },
    () => false
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (sitterId && e.key === `ds_host_messages_${sitterId}`) {
        setUnreadTick((v) => v + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
      } catch {
        // ignore
      }
    })();
    return () => {
      canceled = true;
    };
  }, [sitterId]);

  const baseSitter = useMemo(() => (sitterId ? getSitterById(sitterId) : null), [sitterId]);

  const profile = useMemo<HostProfileV1>(() => {
    if (!sitterId) return getDefaultHostProfile("");
    const remote = remoteProfile as Partial<HostProfileV1> | null | undefined;
    if (remote && typeof remote === "object" && remote.profileVersion === 1 && remote.sitterId === sitterId) {
      return remote as HostProfileV1;
    }
    const stored = loadHostProfileFromStorage(sitterId);
    return stored ?? getDefaultHostProfile(sitterId);
  }, [sitterId, remoteProfile]);

  const badgeStatus = useMemo<"verified" | "pending" | "unverified">(() => {
    if (verificationStatus === "approved") return "verified";
    if (verificationStatus === "pending") return "pending";
    if (profile.verificationStatus === "verified") return "verified";
    if (profile.verificationStatus === "pending") return "pending";
    return "unverified";
  }, [profile.verificationStatus, verificationStatus]);

  const completionPercent = useMemo(() => {
    const effectiveProfile: HostProfileV1 = {
      ...profile,
      verificationStatus: verificationStatus === "approved" ? "verified" : profile.verificationStatus,
    };
    return getHostCompletion(effectiveProfile).percent;
  }, [profile, verificationStatus]);

  const storedReviews = useMemo<DogShiftReview[]>(() => {
    if (!sitterId) return [];
    return loadReviewsFromStorage(sitterId);
  }, [sitterId]);

  const unreadMessages = useMemo(() => {
    void unreadTick;
    if (!sitterId) return 0;
    try {
      return getUnreadHostMessageCount(sitterId);
    } catch {
      return 0;
    }
  }, [sitterId, unreadTick]);

  const reviewCount = storedReviews.length;
  const averageRating = reviewCount
    ? storedReviews.reduce((acc, r) => acc + (Number.isFinite(r.rating) ? r.rating : 0), 0) / reviewCount
    : null;

  const rating = averageRating === null ? "—" : formatRating(averageRating);

  const todos = useMemo(() => {
    const base = getHostTodos(profile);
    if (verificationStatus === "approved") {
      return base.filter((item) => item.id !== "verify");
    }
    return base;
  }, [profile, verificationStatus]);

  const bookings = useMemo(() => (sitterId ? loadHostBookings(sitterId) : []), [sitterId]);
  const statuses = useMemo(() => (sitterId ? loadHostRequestStatus(sitterId) : {}), [sitterId]);
  const pendingRequests = bookings.filter((b) => (statuses[b.bookingId] ?? "new") === "new").length;

  const responseTime = baseSitter?.responseTime ?? "~1h";

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

  const greetingName =
    (typeof profile.firstName === "string" && profile.firstName.trim() ? profile.firstName.trim() : null) ??
    (typeof user?.firstName === "string" && user.firstName.trim() ? user.firstName.trim() : null) ??
    (typeof user?.fullName === "string" && user.fullName.trim() ? user.fullName.trim() : null) ??
    null;

  const avatarSrc =
    (profile.avatarDataUrl && profile.avatarDataUrl.trim() ? profile.avatarDataUrl.trim() : null) ??
    (typeof user?.imageUrl === "string" && user.imageUrl.trim() ? user.imageUrl.trim() : null);

  if (!isLoaded || !isSignedIn) {
    return <PageLoader label="Chargement…" />;
  }

  if (!sitterId) {
    return (
      <div className="relative grid gap-6 overflow-hidden" data-testid="host-dashboard">
        <SunCornerGlow variant="sitterDashboard" />
        <div className="relative z-10 rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Tableau de bord</p>
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
    <div className="relative grid gap-6 overflow-hidden" data-testid="host-dashboard">
      <SunCornerGlow variant="sitterDashboard" />

      <div className="relative z-10">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-sm font-semibold text-slate-600">Tableau de bord</p>
            <div className="mt-2 flex items-center gap-4">
              <HostAvatar
                src={avatarSrc}
                alt={greetingName ? `Photo de profil de ${greetingName}` : "Photo de profil"}
              />
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                <span>Bonjour {greetingName ?? ""}</span>
                {greetingName ? <FilledSunIcon className="h-7 w-7" /> : null}
                {completionPercent < 100 && !completionCardDismissed ? (
                  <div className="ml-0 hidden w-full md:block md:w-auto md:ml-3">
                    <div className="flex w-full items-center justify-center sm:justify-end">
                      <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm sm:px-3">
                        <button
                          type="button"
                          aria-label="Fermer"
                          onClick={() => {
                            try {
                              window.localStorage.setItem(HOST_COMPLETION_CARD_DISMISSED_KEY, "1");
                              window.dispatchEvent(new Event(HOST_COMPLETION_CARD_DISMISSED_EVENT));
                            } catch {
                              // ignore
                            }
                          }}
                          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:text-slate-700"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                            <path
                              d="M6 6l12 12M18 6L6 18"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>

                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-[14px] font-semibold leading-snug text-slate-900">Complète ton profil pour publier</p>
                            <p className="mt-0.5 text-[12.5px] font-normal leading-snug text-slate-700">
                              Ton profil est à {completionPercent}%. Certaines actions restent bloquées tant que le profil n’est pas complet.
                            </p>
                            <div className="mt-0.5">
                              <Link
                                href="/host/profile/edit"
                                className="text-[12.5px] font-medium leading-snug text-[var(--dogshift-blue)] underline"
                              >
                                Compléter mon profil
                              </Link>
                            </div>
                          </div>

                          <div className="shrink-0">
                            <Image
                              src="/5F5E93D5-C27A-4D9D-96D2-894DD1015732.png"
                              alt="Compléter mon profil"
                              width={140}
                              height={140}
                              className="h-16 w-auto object-contain sm:h-20 md:h-24"
                              priority
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </h1>
            </div>
            <div className="mt-3 flex min-h-[32px] flex-wrap items-center gap-2">
              <StatusBadge status={badgeStatus} />
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Profil {completionPercent}%
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-xs font-semibold text-slate-600">Note moyenne</p>
            <div className="mt-2 flex items-center gap-2">
              <StarIcon className="h-5 w-5 text-[#F5B301]" />
              <p className="text-2xl font-semibold text-slate-900">{rating}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-xs font-semibold text-slate-600">Nombre d’avis</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{reviewCount}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-xs font-semibold text-slate-600">Demandes en attente</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingRequests}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-xs font-semibold text-slate-600">Temps de réponse</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{responseTime}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">À faire</h2>
                <p className="mt-1 text-sm text-slate-600">Quelques actions pour optimiser votre profil.</p>
              </div>
            </div>

            {todos.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-emerald-900">Tout est prêt</p>
                <p className="mt-1 text-sm text-emerald-900/80">Votre profil est complet.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {todos.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    <span>{item.label}</span>
                    <span className="ml-auto inline-flex items-center gap-2">
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white opacity-0">
                        0
                      </span>
                      <span className="text-slate-400">→</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">Progression</p>
                <p className="text-xs font-semibold text-slate-600">{completionPercent}%</p>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[var(--dogshift-blue)]" style={{ width: `${completionPercent}%` }} />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <h2 className="text-base font-semibold text-slate-900">Accès rapide</h2>
            <div className="mt-4 space-y-3">
              <Link
                href="/host/requests"
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <span>Demandes & réservations</span>
                <span className="ml-auto inline-flex items-center gap-2">
                  {pendingRequests > 0 ? (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white">
                      {pendingRequests}
                    </span>
                  ) : (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white opacity-0">
                      0
                    </span>
                  )}
                  <span className="text-slate-400">→</span>
                </span>
              </Link>
              <Link
                href="/host/messages"
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <span>Messages</span>
                <span className="ml-auto inline-flex items-center gap-2">
                  {unreadMessages > 0 ? (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white">
                      {unreadMessages}
                    </span>
                  ) : (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white opacity-0">
                      0
                    </span>
                  )}
                  <span className="text-slate-400">→</span>
                </span>
              </Link>

              <Link
                href="/host/settings"
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <span>Paramètres</span>
                <span className="ml-auto inline-flex items-center gap-2">
                  <span className="text-slate-400">→</span>
                </span>
              </Link>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Mes disponibilités</h2>
              <p className="mt-1 text-sm text-slate-600">Clique sur une date pour la rendre disponible / indisponible.</p>
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
                  const rows = Array.isArray(payload.dates) ? payload.dates.filter((d) => typeof d === "string") : [];
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

          <div className="mt-5 rounded-[20px] border border-slate-200 bg-white p-4 sm:p-5">
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
        </section>
      </div>
    </div>
  );
}
