"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";

import SunCornerGlow from "@/components/SunCornerGlow";
import { useHostUser } from "@/components/HostUserProvider";

import { getSitterById } from "@/lib/mockSitters";
import { loadReviewsFromStorage, type DogShiftReview } from "@/lib/reviews";
import { getUnreadHostMessageCount } from "@/lib/hostMessages";
import {
  getDefaultHostProfile,
  getHostTodos,
  loadHostProfileFromStorage,
  type HostProfileV1,
} from "@/lib/hostProfile";
import { loadHostBookings, loadHostRequestStatus } from "@/lib/hostBookings";

function formatRating(rating: number) {
  return rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
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
    return null;
  }

  return (
    <Image src={src} alt={alt} width={56} height={56} className="h-14 w-14 rounded-full border border-slate-200 object-cover" />
  );
}

export default function HostDashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { sitterId, profile: remoteProfile, profileCompletion } = useHostUser();
  const [unreadTick, setUnreadTick] = useState(0);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      window.location.assign("/login");
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (sitterId && e.key === `ds_host_messages_${sitterId}`) {
        setUnreadTick((v) => v + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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

  const todos = useMemo(() => getHostTodos(profile), [profile]);

  const bookings = useMemo(() => (sitterId ? loadHostBookings(sitterId) : []), [sitterId]);
  const statuses = useMemo(() => (sitterId ? loadHostRequestStatus(sitterId) : {}), [sitterId]);
  const pendingRequests = bookings.filter((b) => (statuses[b.bookingId] ?? "new") === "new").length;

  const responseTime = baseSitter?.responseTime ?? "~1h";

  const greetingName =
    (typeof profile.firstName === "string" && profile.firstName.trim() ? profile.firstName.trim() : null) ??
    (typeof user?.firstName === "string" && user.firstName.trim() ? user.firstName.trim() : null) ??
    (typeof user?.fullName === "string" && user.fullName.trim() ? user.fullName.trim() : null) ??
    null;

  const avatarSrc =
    (profile.avatarDataUrl && profile.avatarDataUrl.trim() ? profile.avatarDataUrl.trim() : null) ??
    (typeof user?.imageUrl === "string" && user.imageUrl.trim() ? user.imageUrl.trim() : null);

  if (!isLoaded || !isSignedIn) {
    return null;
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
                {profileCompletion < 100 ? (
                  <div className="ml-0 w-full sm:ml-3 sm:w-auto">
                    <div className="w-full max-w-[420px] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-center">
                          <p className="text-xs font-semibold text-slate-900">Complète ton profil pour publier</p>
                          <p className="mt-1 text-xs font-medium text-slate-700">
                            Ton profil est à {profileCompletion}%. Certaines actions restent bloquées tant que le profil n’est pas complet.
                          </p>
                          <div className="mt-2">
                            <Link href="/host/profile/edit" className="text-xs font-semibold text-[var(--dogshift-blue)]">
                              Compléter mon profil
                            </Link>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Image
                            src="/dogshifit%20logo%20idee.jpg"
                            alt="Compléter mon profil"
                            width={56}
                            height={56}
                            className="h-14 w-14"
                            priority
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </h1>
            </div>
            <div className="mt-3 flex min-h-[32px] flex-wrap items-center gap-2">
              <StatusBadge status={profile.verificationStatus} />
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Profil {profileCompletion}%
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
                <p className="text-xs font-semibold text-slate-600">{profileCompletion}%</p>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[var(--dogshift-blue)]" style={{ width: `${profileCompletion}%` }} />
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
      </div>
    </div>
  );
}
