"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CalendarDays, ChevronLeft, MapPin } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";

type BookingDetail = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sitterId: string;
  service: string | null;
  startDate: string | null;
  endDate: string | null;
  message: string | null;
  status: string;
  canceledAt?: string | null;
  amount: number;
  currency: string;
  platformFeeAmount: number;
  stripePaymentIntentId: string | null;
  sitter: { sitterId: string; name: string; avatarUrl: string | null; city?: string | null; postalCode?: string | null };
};

type ReviewEligibilityPayload = {
  ok?: boolean;
  eligible?: boolean;
  reason?: string;
  alreadyReviewed?: boolean;
  canEdit?: boolean;
};

type ReviewDto = {
  id: string;
  bookingId: string;
  sitterId: string;
  rating: number;
  comment: string | null;
  anonymous: boolean;
  createdAt: string;
  updatedAt: string;
};

type ReviewGetPayload = {
  ok?: boolean;
  review?: ReviewDto | null;
  error?: string;
};

type ReviewPostPayload = {
  ok?: boolean;
  review?: ReviewDto;
  error?: string;
};

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.366 2.447a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.447a1 1 0 00-1.176 0l-3.366 2.447c-.784.57-1.838-.197-1.54-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.102 9.384c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

function avatarIsSafe(src: string) {
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && url.hostname === "lh3.googleusercontent.com";
  } catch {
    return false;
  }
}

function initialForName(name: string) {
  const cleaned = (name ?? "").trim();
  if (!cleaned) return "?";
  return cleaned.slice(0, 1).toUpperCase();
}

function formatDateOnly(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", year: "numeric" }).format(dt);
}

function formatTimeOnly(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("fr-CH", { hour: "2-digit", minute: "2-digit" }).format(dt);
}

function formatChfCents(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(value / 100);
}

function sitterLocation(sitter: { city?: string | null; postalCode?: string | null } | null | undefined) {
  const city = typeof sitter?.city === "string" && sitter.city.trim() ? sitter.city.trim() : "";
  const pc = typeof sitter?.postalCode === "string" && sitter.postalCode.trim() ? sitter.postalCode.trim() : "";
  if (pc && city) return `${pc} ${city}`;
  return city || pc || "—";
}

function reviewLocked(eligibility: ReviewEligibilityPayload | null) {
  return Boolean(eligibility?.alreadyReviewed && !eligibility?.canEdit);
}

export default function AccountBookingReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  const bookingId = typeof params?.id === "string" ? params.id : "";

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eligibility, setEligibility] = useState<ReviewEligibilityPayload | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  const [existingReview, setExistingReview] = useState<ReviewDto | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) router.replace("/login");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !bookingId) return;
    let cancelled = false;

    async function loadBooking() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/account/bookings/${encodeURIComponent(bookingId)}`, { method: "GET" });
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; booking?: BookingDetail; error?: string } | null;
        if (cancelled) return;
        if (!res.ok || !payload?.ok || !payload.booking) {
          setError("Impossible de charger cette réservation.");
          setBooking(null);
          return;
        }
        setBooking(payload.booking);
      } catch {
        if (!cancelled) {
          setError("Impossible de charger cette réservation.");
          setBooking(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBooking();
    return () => {
      cancelled = true;
    };
  }, [bookingId, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !bookingId) return;
    let cancelled = false;

    async function loadEligibility() {
      setEligibilityLoading(true);
      try {
        const res = await fetch(`/api/reviews/eligibility?bookingId=${encodeURIComponent(bookingId)}`, { method: "GET" });
        const payload = (await res.json().catch(() => null)) as ReviewEligibilityPayload | null;
        if (!cancelled) setEligibility(payload);
      } finally {
        if (!cancelled) setEligibilityLoading(false);
      }
    }

    void loadEligibility();
    return () => {
      cancelled = true;
    };
  }, [bookingId, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !bookingId) return;
    if (!eligibility?.alreadyReviewed) {
      setExistingReview(null);
      return;
    }
    let cancelled = false;

    async function loadReview() {
      setReviewLoading(true);
      try {
        const res = await fetch(`/api/reviews?bookingId=${encodeURIComponent(bookingId)}`, { method: "GET" });
        const payload = (await res.json().catch(() => null)) as ReviewGetPayload | null;
        if (cancelled) return;
        if (!res.ok || !payload?.ok) return;
        setExistingReview(payload.review ?? null);
        if (payload.review) {
          setRating(Math.round(payload.review.rating));
          setComment(payload.review.comment ?? "");
          setAnonymous(Boolean(payload.review.anonymous));
        }
      } finally {
        if (!cancelled) setReviewLoading(false);
      }
    }

    void loadReview();
    return () => {
      cancelled = true;
    };
  }, [bookingId, eligibility?.alreadyReviewed, isLoaded, isSignedIn]);

  const summary = useMemo(() => {
    if (!booking) return null;
    const service = booking.service?.trim() ? booking.service.trim() : "Service";
    const day = booking.startDate ? formatDateOnly(booking.startDate) : "—";
    const time = booking.startDate ? formatTimeOnly(booking.startDate) : "";
    const endDay = booking.endDate ? formatDateOnly(booking.endDate) : "";
    const endTime = booking.endDate ? formatTimeOnly(booking.endDate) : "";
    const location = sitterLocation(booking.sitter);
    return {
      service,
      dateLine: endDay && booking.endDate !== booking.startDate ? `${day} → ${endDay}` : day,
      timeLine: time ? `${time}${endTime ? ` – ${endTime}` : ""}` : "—",
      location,
      total: formatChfCents((booking.amount ?? 0) + (booking.platformFeeAmount ?? 0)),
    };
  }, [booking]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="account-booking-review-page">
      <SunCornerGlow variant="ownerBookings" />

      <div className="relative z-10">
        <Link
          href={`/account/bookings/${encodeURIComponent(bookingId)}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Retour à la réservation
        </Link>

        <div className="mt-4 max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
          <p className="text-sm font-semibold text-[var(--dogshift-blue)]">Avis</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Laisser un avis</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Votre retour aide la communauté DogShift à choisir un dogsitter en confiance.
          </p>

          {loading ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm font-medium text-slate-600">Chargement…</div>
          ) : error || !booking || !summary ? (
            <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-900">
              {error || "Réservation introuvable."}
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                    {booking.sitter.avatarUrl && avatarIsSafe(booking.sitter.avatarUrl) ? (
                      <Image src={booking.sitter.avatarUrl} alt={booking.sitter.name} fill className="object-cover" sizes="56px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-base font-semibold text-slate-600">
                        {initialForName(booking.sitter.name)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dogsitter</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{booking.sitter.name}</h2>
                    <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      <span>{summary.location}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4 text-sm">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Service</p>
                    <p className="mt-1 font-semibold text-slate-900">{summary.service}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dates</p>
                    <p className="mt-1 font-semibold text-slate-900">{summary.dateLine}</p>
                    <p className="mt-1 inline-flex items-center gap-2 text-slate-600">
                      <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      <span>{summary.timeLine}</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Montant</p>
                    <p className="mt-1 font-semibold text-slate-900">{summary.total}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                {eligibilityLoading ? (
                  <p className="text-sm font-medium text-slate-600">Chargement…</p>
                ) : eligibility?.ok && eligibility.eligible ? (
                  <div className="space-y-5">
                    {reviewLocked(eligibility) ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">Avis déjà laissé</p>
                        <p className="mt-1 text-sm text-slate-600">Cet avis est maintenant en lecture seule.</p>
                      </div>
                    ) : null}

                    {submitSuccess ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="text-sm font-semibold text-emerald-900">Merci pour votre avis</p>
                        <p className="mt-1 text-sm text-emerald-900/80">Il a bien été enregistré.</p>
                      </div>
                    ) : null}

                    {submitError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                        {submitError}
                      </div>
                    ) : null}

                    {reviewLoading ? <p className="text-sm font-medium text-slate-600">Chargement…</p> : null}

                    <div>
                      <p className="text-sm font-medium text-slate-700">Votre note *</p>
                      <div className="mt-3 flex items-center gap-2">
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const value = idx + 1;
                          const active = rating >= value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                if (reviewLocked(eligibility)) return;
                                setRating(value);
                              }}
                              disabled={reviewLocked(eligibility)}
                              className={
                                active
                                  ? "inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[#F5B301] ring-1 ring-slate-200 transition"
                                  : "inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-300 ring-1 ring-slate-200 transition hover:bg-slate-50"
                              }
                              aria-label={`Donner ${value} étoile${value > 1 ? "s" : ""}`}
                            >
                              <Star className="h-6 w-6" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="review_comment" className="block text-sm font-medium text-slate-700">
                        Commentaire
                      </label>
                      <textarea
                        id="review_comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        disabled={reviewLocked(eligibility)}
                        className="mt-2 min-h-[160px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)] disabled:opacity-60"
                        placeholder="Partagez votre expérience avec ce dogsitter (optionnel)"
                      />
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={anonymous}
                        onChange={(e) => setAnonymous(e.target.checked)}
                        disabled={reviewLocked(eligibility)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Publier de manière anonyme
                    </label>

                    <button
                      type="button"
                      disabled={rating < 1 || submitting || reviewLocked(eligibility)}
                      onClick={async () => {
                        if (submitting || rating < 1) return;
                        setSubmitting(true);
                        setSubmitError(null);
                        setSubmitSuccess(false);
                        try {
                          const res = await fetch("/api/reviews", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              bookingId,
                              rating,
                              comment: comment.trim() ? comment.trim() : null,
                              anonymity: anonymous,
                            }),
                          });
                          const payload = (await res.json().catch(() => null)) as ReviewPostPayload | null;
                          if (!res.ok || !payload?.ok || !payload.review) {
                            setSubmitError("Impossible d’envoyer l’avis. Réessayez.");
                            return;
                          }
                          setExistingReview(payload.review);
                          setSubmitSuccess(true);
                          setEligibility((current) => ({ ...(current ?? {}), ok: true, eligible: true, alreadyReviewed: true, canEdit: true }));
                        } catch {
                          setSubmitError("Impossible d’envoyer l’avis. Réessayez.");
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      className="w-full rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "Envoi…" : eligibility?.alreadyReviewed ? "Mettre à jour mon avis" : "Envoyer"}
                    </button>

                    {existingReview ? (
                      <p className="text-xs font-medium text-slate-500">Dernière mise à jour : {formatDateOnly(existingReview.updatedAt)}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">Avis pas encore disponible</p>
                    <p className="mt-1 text-sm text-slate-600">Vous pourrez laisser un avis une fois la prestation terminée.</p>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
