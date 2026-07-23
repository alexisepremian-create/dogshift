/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { X } from "lucide-react";
import { HostNativeHome } from "@/components/native/HostNativeHome";

import SunCornerGlow from "@/components/SunCornerGlow";
import HostDashboardSkeleton from "@/components/HostDashboardSkeleton";
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
import { endAuthTransition } from "@/lib/native/authTransition";
function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("fr-CH", { month: "long", year: "numeric" }).format(date);
}

function formatRating(rating: number) {
  return rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
}

// The two onboarding banners ("Compte activé" / "Complète ton profil pour
// publier") are now dismissed PERMANENTLY server-side (User.hostProfileJson via
// POST /api/host/dismiss-banner). localStorage was not durable — wiped on
// logout / cache clear / private mode — so a closed banner kept coming back.
// Source of truth = host.dismissedBanners; the close is optimistic + a POST.
async function postDismissBanner(banner: "accountActivated" | "completionCard") {
  try {
    await fetch("/api/host/dismiss-banner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ banner }),
    });
  } catch {
    // Best-effort: the UI already hid it optimistically; the next server load
    // reflects the persisted state.
  }
}

function AccountActivatedBanner({ initialDismissed }: { initialDismissed: boolean }) {
  const searchParams = useSearchParams();
  const debugShow = searchParams.get("showBanner") === "1";
  const [exiting, setExiting] = useState(false);
  const [dismissed, setDismissed] = useState(initialDismissed);

  const shouldShow = debugShow || !dismissed || exiting;
  if (!shouldShow) return null;

  function dismiss() {
    setExiting(true);
    void postDismissBanner("accountActivated");
    window.setTimeout(() => {
      setDismissed(true);
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
        Ton compte dogsitter est activé. Tu peux finaliser ta publication si le reste du profil est prêt.
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

function publishBlockedMessage(code: string): string {
  const msgs: Record<string, string> = {
    TERMS_NOT_ACCEPTED: "Accepte le règlement avant de publier ton annonce.",
    PROFILE_INCOMPLETE: "Complète ton profil à 100 % avant de publier.",
    CONTRACT_NOT_SIGNED: "Signe le contrat avant de publier ton annonce.",
    ACCOUNT_NOT_ACTIVATED: "Ton compte doit être activé pour publier.",
    CONTRACT_AMENDMENT_REQUIRED: "Un avenant au contrat doit être accepté avant de publier.",
    NO_AVAILABILITY: "Ajoute au moins un créneau de disponibilité avant de publier.",
  };
  return msgs[code] ?? "La publication a été bloquée.";
}

export default function HostDashboardPage() {
  const { data: __session, status: __sessionStatus } = useSession();
  const user = __session?.user ?? null;
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";
  const host = useHostUser();
  const router = useRouter();
  const { sitterId, profile: remoteProfile, published: isPublished } = host;
  const [unreadTick, setUnreadTick] = useState(0);
  // Instant avatar sync: when the native dashboard uploads a new photo we don't
  // want to wait for a full reload for the completion % / to-do list to update.
  // The child reports the committed URL up; we fold it into `profile` so the
  // memoised completionPercent + todos recompute on the spot (founder: "il faut
  // que ce soit synchro direct").
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"not_verified" | "pending" | "approved" | "rejected">(
    (host.verificationStatus === "approved" || host.verificationStatus === "pending" || host.verificationStatus === "rejected")
      ? host.verificationStatus
      : "not_verified"
  );
  const [verificationLoaded, setVerificationLoaded] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  // Gates the dashboard reveal on the profile photo being decoded (see effect
  // near avatarSrc) so nothing (incl. the avatar) pops in after the skeleton.
  const [avatarReady, setAvatarReady] = useState(false);
  // Permanent, server-persisted dismissal (see postDismissBanner). Optimistic
  // local state; the server value (host.dismissedBanners) is the source of
  // truth on the next load, so a closed card never comes back.
  const [completionCardDismissed, setCompletionCardDismissed] = useState(
    Boolean(host.dismissedBanners?.completionCard)
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
    const base = (() => {
      if (!sitterId) return getDefaultHostProfile("");
      const remote = remoteProfile as Partial<HostProfileV1> | null | undefined;
      if (remote && typeof remote === "object" && remote.profileVersion === 1 && remote.sitterId === sitterId) {
        return remote as HostProfileV1;
      }
      const stored = loadHostProfileFromStorage(sitterId);
      return stored ?? getDefaultHostProfile(sitterId);
    })();
    // A just-uploaded avatar (reported by the native dashboard) takes precedence
    // over the server snapshot until the next reload catches up.
    return avatarOverride ? { ...base, avatarUrl: avatarOverride } : base;
  }, [sitterId, remoteProfile, avatarOverride]);

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

  // Login lands sitters here (resolve-redirect → /host). End the native auth
  // splash only once THIS page is past its own DashboardSkeleton (below) and
  // about to render real content — otherwise the splash faded to reveal the
  // page's skeleton (founder: "ça révèle le skeleton à la reconnexion").
  const hostContentReady = isLoaded && isSignedIn && (!sitterId || verificationLoaded);
  useEffect(() => {
    if (hostContentReady) endAuthTransition();
  }, [hostContentReady]);

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

  const needsAvailability = host.availabilityCoverageOk === false && (host.enabledServices?.length ?? 0) > 0;

  const todos = useMemo(() => {
    const base = getHostTodos({ ...profile, stripeAccountStatus: host.stripeAccountStatus });
    const filtered =
      verificationStatus === "approved" || verificationStatus === "pending"
        ? base.filter((item) => item.id !== "verify")
        : base;
    // Availability isn't part of the profile-completion %, but a sitter with no
    // bookable schedule is invisible in search — surface it as a to-do (and it
    // keeps the "Publier" CTA hidden until they set it).
    if (needsAvailability && !filtered.some((i) => i.id === "availability")) {
      filtered.push({ id: "availability", label: "Définir tes disponibilités", href: "/host/availability" });
    }
    return filtered;
  }, [profile, verificationStatus, host.stripeAccountStatus, needsAvailability]);

  // Publish from the dashboard. Only rendered when todos.length === 0, i.e. the
  // profile is complete AND authoritative (getHostTodos passed on the remote
  // profile), so re-posting it back with published:true is safe.
  async function onPublish() {
    if (publishing) return;
    setPublishError(null);
    setPublishing(true);
    try {
      const res = await fetch("/api/host/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...profile, published: true }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; published?: boolean; publishBlocked?: { error: string } | null }
        | null;
      if (payload?.publishBlocked) {
        setPublishError(publishBlockedMessage(payload.publishBlocked.error));
        setPublishing(false);
        return;
      }
      if (!res.ok || !payload?.ok) {
        setPublishError("La publication a échoué. Réessaie.");
        setPublishing(false);
        return;
      }
      router.refresh();
    } catch {
      setPublishError("La publication a échoué. Réessaie.");
      setPublishing(false);
    }
  }

  const bookings = useMemo(() => (sitterId ? loadHostBookings(sitterId) : []), [sitterId]);
  const statuses = useMemo(() => (sitterId ? loadHostRequestStatus(sitterId) : {}), [sitterId]);
  const pendingRequests = bookings.filter((b) => (statuses[b.bookingId] ?? "new") === "new").length;

  const responseTime = baseSitter?.responseTime ?? "~1h";

  const greetingName =
    (typeof profile.firstName === "string" && profile.firstName.trim() ? profile.firstName.trim() : null) ??
    (typeof user?.name === "string" && user?.name.trim() ? user?.name.trim() : null) ??
    (typeof user?.name === "string" && user?.name.trim() ? user?.name.trim() : null) ??
    null;

  // Prefer the committed R2 media path (SitterProfile.avatarUrl, set on avatar
  // commit) over the legacy base64 avatarDataUrl — otherwise a stale localStorage
  // base64 blob wins over the freshly uploaded photo and the avatar desyncs vs
  // the public profile / sitters list (which always read SitterProfile.avatarUrl).
  const avatarSrc =
    (profile.avatarUrl && profile.avatarUrl.trim() ? profile.avatarUrl.trim() : null) ??
    (profile.avatarDataUrl && profile.avatarDataUrl.trim() ? profile.avatarDataUrl.trim() : null);

  // Hold the dashboard skeleton until the profile photo is actually decoded, so
  // the reveal shows everything AT ONCE — otherwise the avatar popped in a beat
  // after the skeleton handed off (founder). Instant for no/`data:` avatars;
  // capped at 2.5s so a slow or broken image never traps the dashboard on the
  // skeleton. Only gates the FIRST reveal — once ready it stays ready, so a
  // later photo change (avatarOverride) never re-flashes the skeleton.
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setAvatarReady(true);
      }
    };
    if (!avatarSrc || avatarSrc.startsWith("data:")) {
      const raf = requestAnimationFrame(finish);
      return () => {
        done = true;
        cancelAnimationFrame(raf);
      };
    }
    const img = new window.Image();
    img.onload = finish;
    img.onerror = finish;
    img.src = avatarSrc;
    const t = setTimeout(finish, 2500);
    return () => {
      done = true;
      clearTimeout(t);
    };
  }, [avatarSrc]);

  if (!isLoaded || !isSignedIn) return <HostDashboardSkeleton />;

  if (sitterId && !verificationLoaded) {
    return <HostDashboardSkeleton />;
  }

  // Everything else is ready; wait only for the avatar to be decoded so the
  // dashboard reveals with the photo already in place (never an empty circle).
  if (sitterId && !avatarReady) {
    return <HostDashboardSkeleton />;
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
        <div className="ds-card relative z-10 rounded-3xl border border-slate-200 bg-white p-6">
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
    <>
      {/* ── Native app: minimalist dashboard (sitter) — tiles open in a sheet ── */}
      <div className="ds-native-only">
        <HostNativeHome
          greetingName={greetingName ?? null}
          avatarSrc={avatarSrc}
          isPublished={Boolean(isPublished)}
          completionUiReady={completionUiReady}
          completionPercent={completionPercent}
          rating={rating}
          pendingRequests={pendingRequests}
          unreadMessages={unreadMessages}
          onAvatarChange={setAvatarOverride}
          todos={todos.map((t) => ({ id: t.id, label: t.label, href: t.href }))}
        />
      </div>

      {/* ── Web dashboard (unchanged) ──────────────────────────────────────── */}
      <div className="ds-web-only relative grid gap-6 overflow-hidden" data-testid="host-dashboard">
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
          <AccountActivatedBanner initialDismissed={Boolean(host.dismissedBanners?.accountActivated)} />
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
                            setCompletionCardDismissed(true);
                            void postDismissBanner("completionCard");
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
                  <span
                    className={
                      isPublished
                        ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
                        : "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
                    }
                  >
                    <span aria-hidden="true">●</span>
                    {isPublished ? "Annonce publiée" : "Annonce non publiée"}
                  </span>
                  <StatusBadge status={badgeStatus} />
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                    Profil {completionPercent}%
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {completionUiReady && isPublished && needsAvailability ? (
          <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Ton annonce est en ligne, mais invisible</p>
            <p className="mt-1 text-sm text-amber-900/80">
              Tu n&apos;as aucune disponibilité : les clients ne peuvent pas te réserver. Ajoute tes créneaux pour apparaître dans la recherche.
            </p>
            <Link
              href="/host/availability"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-900 underline"
            >
              Définir mes disponibilités →
            </Link>
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="ds-stat rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-xs font-semibold text-slate-600">Note moyenne</p>
            <div className="mt-2 flex items-center gap-2">
              <StarIcon className="h-5 w-5 text-[#F5B301]" />
              <p className="text-2xl font-semibold text-slate-900">{rating}</p>
            </div>
          </div>

          <div className="ds-stat rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-xs font-semibold text-slate-600">Nombre d’avis</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{reviewCount}</p>
          </div>

          <div className="ds-stat rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-xs font-semibold text-slate-600">Réservations en attente</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingRequests}</p>
          </div>

          <div className="ds-stat rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-xs font-semibold text-slate-600">Temps de réponse</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{responseTime}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="ds-card rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">À faire</h2>
                <p className="mt-1 text-sm text-slate-600">Quelques actions pour optimiser ton profil.</p>
              </div>
            </div>

            {todos.length === 0 ? (
              isPublished ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-sm font-semibold text-emerald-900">Tout est en ordre ✓</p>
                  <p className="mt-1 text-sm text-emerald-900/80">
                    Ton profil est publié et complet. Rien à faire pour l&apos;instant.
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-sm font-semibold text-emerald-900">Ton profil est prêt 🎉</p>
                  <p className="mt-1 text-sm text-emerald-900/80">
                    Tout est complet. Publie ton annonce pour apparaître dans la recherche et recevoir des réservations.
                  </p>
                  <button
                    type="button"
                    onClick={() => void onPublish()}
                    aria-disabled={publishing}
                    style={{ touchAction: "manipulation" }}
                    className="mt-3 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]"
                  >
                    {publishing ? "Publication…" : "Publier mon annonce"}
                  </button>
                  {publishError ? <p className="mt-2 text-sm font-medium text-rose-600">{publishError}</p> : null}
                </div>
              )
            ) : (
              <div className="mt-5 space-y-3">
                {todos.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="ds-row flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
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

          <section className="ds-card rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <h2 className="text-base font-semibold text-slate-900">Accès rapide</h2>
            <div className="mt-4 space-y-3">
              <Link
                href="/host/requests"
                className="ds-row flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
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
                className="ds-row flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
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
                className="ds-row flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
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
    </>
  );
}
