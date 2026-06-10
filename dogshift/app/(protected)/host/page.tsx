/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { X } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";
import { useHostUser } from "@/components/HostUserProvider";
import HowItWorksSchema, { SITTER_HOW_IT_WORKS_CONTENT } from "@/components/HowItWorksSchema";

import { getSitterById } from "@/lib/mockSitters";
import { getUnreadHostMessageCount } from "@/lib/hostMessages";
import {
  getDefaultHostProfile,
  getHostCompletion,
  getHostTodos,
  loadHostProfileFromStorage,
  type HostProfileV1,
  type HostVerificationStatus,
} from "@/lib/hostProfile";
import { loadHostBookings, loadHostRequestStatus } from "@/lib/hostBookings";
function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("fr-CH", { month: "long", year: "numeric" }).format(date);
}

function formatRating(rating: number) {
  return rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
}

// Audit 2026-05-22 follow-up: the dashboard banners ("Compte activé" /
// "Complète ton profil pour publier") used localStorage keys suffixed by
// `sitterId`. On page navigation back to /host the component remounted and
// briefly read with `sitterId === null` (different key) → returned "not
// dismissed" → the banner flashed back even though the user had closed it
// moments earlier. localStorage is already per-origin (= per-browser
// session = effectively per-sitter once they're signed in), so suffixing by
// sitterId added zero security and a lot of brittleness. We use a single
// stable key now. v2 suffix forces a clean dismissal state for users coming
// from the buggy v1 keys.
const HOST_COMPLETION_CARD_DISMISSED_KEY = "ds_host_completion_card_dismissed_v2";
const HOST_COMPLETION_CARD_DISMISSED_EVENT = "ds_host_completion_card_dismissed";

function hostCompletionCardDismissedKey(_sitterId: string | null): string {
  return HOST_COMPLETION_CARD_DISMISSED_KEY;
}

const DOGSHIFT_BANNER_ACCOUNT_ACTIVATED_CLOSED_KEY = "ds_banner_account_activated_closed_v2";
const DOGSHIFT_BANNER_ACCOUNT_ACTIVATED_CLOSED_EVENT = "dogshift:banner_account_activated_closed";

function accountActivatedBannerClosedKey(_sitterId: string | null): string {
  return DOGSHIFT_BANNER_ACCOUNT_ACTIVATED_CLOSED_KEY;
}

function subscribeAccountActivatedBannerClosed(sitterId: string | null) {
  const storageKey = accountActivatedBannerClosedKey(sitterId);
  return (onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => {};

    const onCustom = () => onStoreChange();
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) onStoreChange();
    };
    window.addEventListener(DOGSHIFT_BANNER_ACCOUNT_ACTIVATED_CLOSED_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DOGSHIFT_BANNER_ACCOUNT_ACTIVATED_CLOSED_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  };
}

function readAccountActivatedBannerClosed(sitterId: string | null): boolean {
  try {
    return window.localStorage.getItem(accountActivatedBannerClosedKey(sitterId)) === "1";
  } catch {
    return false;
  }
}

function AccountActivatedBanner({ sitterId }: { sitterId: string | null }) {
  const searchParams = useSearchParams();
  const debugShow = searchParams.get("showBanner") === "1";
  const subscribe = useMemo(() => subscribeAccountActivatedBannerClosed(sitterId), [sitterId]);
  const persistedClosed = useSyncExternalStore(
    subscribe,
    () => readAccountActivatedBannerClosed(sitterId),
    () => false
  );
  const [exiting, setExiting] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);

  useEffect(() => {
    if (searchParams.get("showBanner") === "1") {
      setSessionDismissed(false);
    }
  }, [searchParams]);

  // Audit 2026-05-22: removed the `[sitterId]` reset effect that re-armed
  // the banner on every navigation back to /host. localStorage already
  // tracks the persistent dismissal state — the in-component
  // `sessionDismissed` only needs to be reset by `showBanner=1` query.

  const shouldShow = !sessionDismissed && (debugShow || !persistedClosed || exiting);
  if (!shouldShow) return null;

  function dismiss() {
    setExiting(true);
    window.setTimeout(() => {
      try {
        window.localStorage.setItem(accountActivatedBannerClosedKey(sitterId), "1");
        window.dispatchEvent(new Event(DOGSHIFT_BANNER_ACCOUNT_ACTIVATED_CLOSED_EVENT));
      } catch {
        // ignore
      }
      setSessionDismissed(true);
      setExiting(false);
    }, 200);
  }

  return (
    <section
      className={`relative mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 pr-10 transition duration-200 ease-out motion-reduce:transition-none ${
        exiting ? "pointer-events-none opacity-0 -translate-y-1" : "translate-y-0 opacity-100"
      }`}
    >
      <button
        type="button"
        aria-label="Fermer la bannière"
        onClick={dismiss}
        className="absolute right-3 top-3 cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2"
      >
        <X className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
      </button>
      <p className="text-sm font-semibold text-emerald-900">Compte activé</p>
      <p className="mt-1 text-sm text-emerald-900/80">
        Votre compte dogsitter est activé. Vous pouvez finaliser votre publication si le reste du profil est prêt.
      </p>
    </section>
  );
}

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

function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-pulse rounded-md bg-slate-200/80 ${className ?? ""}`}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div
      className="relative grid gap-6 overflow-hidden"
      data-testid="host-dashboard-skeleton"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="hidden sm:block">
        <SunCornerGlow variant="sitterDashboard" />
      </div>
      <div
        className="pointer-events-none fixed inset-0 z-0 sm:hidden"
        aria-hidden="true"
        style={{
          background: "linear-gradient(135deg, rgba(250,204,21,0.22) 0%, rgba(251,146,60,0.10) 28%, transparent 58%)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 160px, rgba(0,0,0,0) 300px)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 160px, rgba(0,0,0,0) 300px)",
        }}
      />
      <span className="sr-only">Chargement du tableau de bord…</span>

      <div className="relative z-10">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Skeleton className="h-4 w-32" />
            <div className="mt-2 flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex w-full items-center gap-3">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-7 w-7 rounded-full" />
                <div className="ml-3 hidden w-full max-w-[420px] md:block">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-4 w-56 max-w-full" />
                        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
                        <Skeleton className="mt-2 h-3 w-36 max-w-full" />
                      </div>
                      <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex min-h-[32px] flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-7 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-3 w-64 max-w-full" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="mt-2 h-2 w-full rounded-full" />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <Skeleton className="h-4 w-28" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function HostAvatar({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className="h-14 w-14 rounded-full border border-slate-200 bg-white"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={56}
      height={56}
      unoptimized
      className="h-14 w-14 rounded-full border border-slate-200 object-cover bg-white"
    />
  );
}

export default function HostDashboardPage() {
  const { data: __session, status: __sessionStatus } = useSession();
  const user = __session?.user ?? null;
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";
  const host = useHostUser();
  const { sitterId, profile: remoteProfile, published: isPublished } = host;
  const [unreadTick, setUnreadTick] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<"not_verified" | "pending" | "approved" | "rejected">(
    (host.verificationStatus === "approved" || host.verificationStatus === "pending" || host.verificationStatus === "rejected")
      ? host.verificationStatus
      : "not_verified"
  );
  const [verificationLoaded, setVerificationLoaded] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const completionCardStorageKey = hostCompletionCardDismissedKey(sitterId);
  const subscribeCompletionCardDismissed = useMemo(() => {
    return (onStoreChange: () => void) => {
      if (typeof window === "undefined") return () => {};

      const onCustom = () => onStoreChange();
      window.addEventListener(HOST_COMPLETION_CARD_DISMISSED_EVENT, onCustom);

      const onStorage = (e: StorageEvent) => {
        if (e.key === completionCardStorageKey) {
          onStoreChange();
        }
      };
      window.addEventListener("storage", onStorage);

      return () => {
        window.removeEventListener(HOST_COMPLETION_CARD_DISMISSED_EVENT, onCustom);
        window.removeEventListener("storage", onStorage);
      };
    };
  }, [completionCardStorageKey]);

  const completionCardDismissed = useSyncExternalStore(
    subscribeCompletionCardDismissed,
    () => {
      try {
        return window.localStorage.getItem(completionCardStorageKey) === "1";
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
    if (!sitterId) {
      setVerificationLoaded(true);
      return;
    }
    setVerificationLoaded(false);
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
      } finally {
        if (!canceled) {
          setVerificationLoaded(true);
        }
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
    return getHostCompletion({ ...profile, stripeAccountStatus: host.stripeAccountStatus }).percent;
  }, [profile, host.stripeAccountStatus]);

  const completionUiReady = Boolean(sitterId) && verificationLoaded;

  useEffect(() => {
    if (!sitterId) {
      setReviewCount(0);
      setAverageRating(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/sitters/${encodeURIComponent(sitterId)}?mode=preview`, { method: "GET" });
        const payload = (await res.json().catch(() => null)) as
          | { ok?: boolean; sitter?: { countReviews?: number; averageRating?: number | null } }
          | null;

        if (cancelled) return;
        if (!res.ok || !payload?.ok || !payload.sitter) {
          setReviewCount(0);
          setAverageRating(null);
          return;
        }

        setReviewCount(typeof payload.sitter.countReviews === "number" && Number.isFinite(payload.sitter.countReviews) ? payload.sitter.countReviews : 0);
        setAverageRating(
          typeof payload.sitter.averageRating === "number" && Number.isFinite(payload.sitter.averageRating) ? payload.sitter.averageRating : null
        );
      } catch {
        if (cancelled) return;
        setReviewCount(0);
        setAverageRating(null);
      }
    })();

    return () => {
      cancelled = true;
    };
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

  const rating = averageRating === null ? "—" : formatRating(averageRating);

  const todos = useMemo(() => {
    const base = getHostTodos({ ...profile, stripeAccountStatus: host.stripeAccountStatus });
    if (verificationStatus === "approved" || verificationStatus === "pending") {
      return base.filter((item) => item.id !== "verify");
    }
    return base;
  }, [profile, verificationStatus, host.stripeAccountStatus]);

  const bookings = useMemo(() => (sitterId ? loadHostBookings(sitterId) : []), [sitterId]);
  const statuses = useMemo(() => (sitterId ? loadHostRequestStatus(sitterId) : {}), [sitterId]);
  const pendingRequests = bookings.filter((b) => (statuses[b.bookingId] ?? "new") === "new").length;

  const responseTime = baseSitter?.responseTime ?? "~1h";

  const greetingName =
    (typeof profile.firstName === "string" && profile.firstName.trim() ? profile.firstName.trim() : null) ??
    (typeof user?.name === "string" && user?.name.trim() ? user?.name.trim() : null) ??
    (typeof user?.name === "string" && user?.name.trim() ? user?.name.trim() : null) ??
    null;

  const avatarSrc =
    (profile.avatarDataUrl && profile.avatarDataUrl.trim() ? profile.avatarDataUrl.trim() : null) ??
    (profile.avatarUrl && profile.avatarUrl.trim() ? profile.avatarUrl.trim() : null);

  if (!isLoaded || !isSignedIn) return <DashboardSkeleton />;

  if (sitterId && !verificationLoaded) {
    return <DashboardSkeleton />;
  }

  if (!sitterId) {
    return (
      <div className="relative grid gap-6 overflow-hidden" data-testid="host-dashboard">
        <div className="hidden sm:block">
          <SunCornerGlow variant="sitterDashboard" />
        </div>
        <div
          className="pointer-events-none fixed inset-0 z-0 sm:hidden"
          aria-hidden="true"
          style={{
            background: "linear-gradient(135deg, rgba(250,204,21,0.22) 0%, rgba(251,146,60,0.10) 28%, transparent 58%)",
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 160px, rgba(0,0,0,0) 300px)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 160px, rgba(0,0,0,0) 300px)",
          }}
        />
        <div className="relative z-10 rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Tableau de bord</p>
          <p className="mt-2 text-sm text-slate-600">Ton profil hôte n’est pas encore disponible.</p>
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
    <div className="relative grid gap-6 overflow-hidden" data-testid="host-dashboard">
      {/* Desktop: full animated sun rays */}
      <div className="hidden sm:block">
        <SunCornerGlow variant="sitterDashboard" />
      </div>
      {/* Mobile: simple warm yellow gradient — same as owner dashboard */}
      <div
        className="pointer-events-none fixed inset-0 z-0 sm:hidden"
        aria-hidden="true"
        style={{
          background: "linear-gradient(135deg, rgba(250,204,21,0.22) 0%, rgba(251,146,60,0.10) 28%, transparent 58%)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 160px, rgba(0,0,0,0) 300px)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 160px, rgba(0,0,0,0) 300px)",
        }}
      />

      <div className="relative z-10">
        <Suspense fallback={null}>
          <AccountActivatedBanner sitterId={sitterId} />
        </Suspense>

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
                {completionUiReady && completionPercent < 100 && !completionCardDismissed ? (
                  <div className="ml-0 hidden w-full md:block md:w-auto md:ml-3">
                    <div className="flex w-full items-center justify-center sm:justify-end">
                      <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm sm:px-3">
                        <button
                          type="button"
                          aria-label="Fermer"
                          onClick={() => {
                            try {
                              window.localStorage.setItem(completionCardStorageKey, "1");
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
              {completionUiReady ? (
                <>
                  <StatusBadge status={badgeStatus} />
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                    Profil {completionPercent}%
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
            <p className="text-xs font-semibold text-slate-600">Réservations en attente</p>
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
                <p className="text-sm font-semibold text-emerald-900">
                  {isPublished ? "Tout est en ordre ✓" : "Profil complet"}
                </p>
                <p className="mt-1 text-sm text-emerald-900/80">
                  {isPublished
                    ? "Votre profil est publié et complet. Rien à faire pour l'instant."
                    : "Votre profil est complet. Rendez-vous dans l'onglet profil pour le publier."}
                </p>
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
                <span>Réservations</span>
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

        <div className="mt-8">
          <HowItWorksSchema {...SITTER_HOW_IT_WORKS_CONTENT} />
        </div>

      </div>
    </div>
  );
}
