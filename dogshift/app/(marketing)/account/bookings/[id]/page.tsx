"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CalendarDays, Clock3 } from "lucide-react";

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

function sitterLocation(sitter: { city?: string | null; postalCode?: string | null } | null | undefined) {
  const city = typeof sitter?.city === "string" && sitter.city.trim() ? sitter.city.trim() : "";
  const pc = typeof sitter?.postalCode === "string" && sitter.postalCode.trim() ? sitter.postalCode.trim() : "";
  if (pc && city) return `${pc} ${city}`;
  return city || pc || "";
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

function formatChfCents(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(value / 100);
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

function isHourlyService(service: string | null) {
  return service === "Promenade" || service === "Garde";
}

function isDailyService(service: string | null) {
  return service === "Pension";
}

function isMidnightUtc(iso: string | null) {
  if (!iso) return true;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return true;
  return dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0;
}

function computeDurationHours(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return null;
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  const hours = (b - a) / (60 * 60 * 1000);
  const rounded = Math.ceil(hours * 2) / 2;
  return Math.max(0.5, rounded);
}

function daysBetweenInclusive(startIso: string, endIso: string) {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  const diff = Math.round((b - a) / (24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

function normalizeStatus(status: string, endDateIso: string | null) {
  const now = Date.now();
  const end = endDateIso ? new Date(endDateIso).getTime() : NaN;

  if (status === "CONFIRMED" && Number.isFinite(end) && now > end) {
    return "COMPLETED";
  }

  if (status === "PENDING_PAYMENT") return "PENDING";
  if (status === "CANCELLED") return "CANCELED";
  return status;
}

function canCancelBooking(booking: BookingDetail, normalizedStatus: string) {
  if (normalizedStatus === "CANCELED" || normalizedStatus === "COMPLETED") return false;
  if (String(booking.status ?? "") === "CANCELLED") return false;
  if (String(booking.status ?? "") === "REFUNDED") return false;
  if (String(booking.status ?? "") === "REFUND_FAILED") return false;

  const startIso = booking.startDate;
  if (!startIso) return true;
  const startTs = new Date(startIso).getTime();
  if (!Number.isFinite(startTs)) return true;

  const limit = startTs - 24 * 60 * 60 * 1000;
  return Date.now() <= limit;
}

function cancelTooltip(booking: BookingDetail, cancellable: boolean) {
  if (cancellable) return undefined;

  const startIso = booking.startDate;
  if (startIso) {
    const startTs = new Date(startIso).getTime();
    if (Number.isFinite(startTs)) {
      const limit = startTs - 24 * 60 * 60 * 1000;
      if (Date.now() > limit) {
        return "Annulation possible jusqu’à 24h avant le début de la prestation";
      }
    }
  }

  return "Pour annuler une réservation confirmée, contacte le sitter/support.";
}

function statusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return { label: "En attente", tone: "amber" as const };
    case "PENDING_ACCEPTANCE":
      return { label: "En attente d’acceptation", tone: "amber" as const };
    case "PAID":
      return { label: "En attente d’acceptation", tone: "amber" as const };
    case "CONFIRMED":
      return { label: "Confirmée", tone: "emerald" as const };
    case "COMPLETED":
      return { label: "Terminée", tone: "slate" as const };
    case "CANCELED":
      return { label: "Annulée", tone: "slate" as const };
    case "REFUNDED":
      return { label: "Remboursée", tone: "slate" as const };
    case "REFUND_FAILED":
      return { label: "Remboursement échoué", tone: "rose" as const };
    case "PAYMENT_FAILED":
      return { label: "Paiement refusé", tone: "rose" as const };
    case "DRAFT":
      return { label: "Brouillon", tone: "slate" as const };
    default:
      return { label: status || "—", tone: "slate" as const };
  }
}

function StatusPill({ status }: { status: string }) {
  const s = statusLabel(status);
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold shadow-sm";
  if (s.tone === "emerald") return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}>{s.label}</span>;
  if (s.tone === "amber") return <span className={`${base} border-amber-200 bg-amber-50 text-amber-800`}>{s.label}</span>;
  if (s.tone === "rose") return <span className={`${base} border-rose-200 bg-rose-50 text-rose-800`}>{s.label}</span>;
  return <span className={`${base} border-slate-200 bg-slate-50 text-slate-700`}>{s.label}</span>;
}

export default function AccountBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();

  const bookingId = typeof params?.id === "string" ? params.id : "";

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [eligibility, setEligibility] = useState<ReviewEligibilityPayload | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  const [existingReview, setExistingReview] = useState<ReviewDto | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [anonymous, setAnonymous] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSent, setReviewSent] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function loadBooking() {
    if (!isLoaded || !isSignedIn) return null;
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/bookings/${encodeURIComponent(bookingId)}`, { method: "GET" });
      const payload = (await res.json()) as { ok?: boolean; booking?: BookingDetail; error?: string };

      if (!res.ok || !payload.ok || !payload.booking) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") {
          setError("Connexion requise (401). ");
          return;
        }
        if (res.status === 403 || payload.error === "FORBIDDEN") {
          setError("Accès refusé (403).");
          setBooking(null);
          return;
        }
        if (res.status === 404 || payload.error === "NOT_FOUND") {
          setError("Introuvable (404).");
          setBooking(null);
          return;
        }
        if (res.status >= 500) {
          setError("Erreur serveur (500). ");
          setBooking(null);
          return;
        }
        setError("Impossible de charger la réservation.");
        setBooking(null);
        return;
      }

      setBooking(payload.booking);
    } catch {
      setError("Impossible de charger la réservation.");
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void loadBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, isLoaded, isSignedIn]);

  useEffect(() => {
    const wantsOpen = (sp?.get("review") ?? "").trim() === "1";
    if (wantsOpen) setReviewOpen(true);
  }, [sp]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!bookingId) return;

    let cancelled = false;
    async function loadEligibility() {
      setEligibilityLoading(true);
      setReviewError(null);
      try {
        const res = await fetch(`/api/reviews/eligibility?bookingId=${encodeURIComponent(bookingId)}`, { method: "GET" });
        const payload = (await res.json().catch(() => null)) as ReviewEligibilityPayload | null;
        if (cancelled) return;
        if (!res.ok || !payload?.ok) {
          setEligibility({ ok: false, eligible: false, reason: "ERROR" });
          return;
        }
        setEligibility(payload);
      } catch {
        if (cancelled) return;
        setEligibility({ ok: false, eligible: false, reason: "ERROR" });
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
    if (!isLoaded || !isSignedIn) return;
    if (!bookingId) return;
    if (!eligibility?.alreadyReviewed) {
      setExistingReview(null);
      return;
    }

    let cancelled = false;
    async function loadExisting() {
      setReviewLoading(true);
      try {
        const res = await fetch(`/api/reviews?bookingId=${encodeURIComponent(bookingId)}`, { method: "GET" });
        const payload = (await res.json().catch(() => null)) as ReviewGetPayload | null;
        if (cancelled) return;
        if (!res.ok || !payload?.ok) {
          setExistingReview(null);
          return;
        }
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
    void loadExisting();
    return () => {
      cancelled = true;
    };
  }, [bookingId, eligibility?.alreadyReviewed, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const computed = useMemo(() => {
    if (!booking) return null;

    const service = booking.service?.trim() ? booking.service.trim() : "Service";

    const isHourlyByService = isHourlyService(booking.service);
    const isDailyByService = isDailyService(booking.service);
    const isHourlyByDates = !isMidnightUtc(booking.startDate) || !isMidnightUtc(booking.endDate);

    const pricingUnit = isHourlyByService || (!isDailyByService && isHourlyByDates) ? "HOURLY" : "DAILY";

    const normalizedStatus = normalizeStatus(String(booking.status ?? ""), booking.endDate);
    const cancellable = canCancelBooking(booking, normalizedStatus);
    const cancelHidden =
      normalizedStatus === "COMPLETED" ||
      String(booking.status ?? "") === "CANCELLED" ||
      String(booking.status ?? "") === "REFUNDED" ||
      String(booking.status ?? "") === "REFUND_FAILED";

    const canPay = String(booking.status ?? "") === "PENDING_PAYMENT";

    const dateLine = (() => {
      if (!booking.startDate) return "—";
      if (pricingUnit === "HOURLY") {
        const day = formatDateOnly(booking.startDate);
        const start = formatTimeOnly(booking.startDate);
        const end = booking.endDate ? formatTimeOnly(booking.endDate) : "";
        const dur = computeDurationHours(booking.startDate, booking.endDate);
        const durLabel = dur ? ` (${dur} h)` : "";
        return `${day}${start ? ` · ${start}` : ""}${end ? ` → ${end}` : ""}${durLabel}`;
      }

      if (!booking.endDate || booking.endDate === booking.startDate) {
        return `${formatDateOnly(booking.startDate)} (1 jour)`;
      }

      const days = daysBetweenInclusive(booking.startDate, booking.endDate);
      const nights = Math.max(0, days - 1);
      const suffix = nights > 0 ? ` (${nights} nuit${nights > 1 ? "s" : ""})` : ` (${days} jour${days > 1 ? "s" : ""})`;
      return `${formatDateOnly(booking.startDate)} → ${formatDateOnly(booking.endDate)}${suffix}`;
    })();

    const fee = Number.isFinite(booking.platformFeeAmount) ? booking.platformFeeAmount : 0;
    const amount = Number.isFinite(booking.amount) ? booking.amount : 0;
    const total = amount;

    return {
      service,
      pricingUnit,
      normalizedStatus,
      cancellable,
      cancelHidden,
      canPay,
      dateLine,
      fee,
      amount,
      total,
      totalLabel: formatChfCents(total),
    };
  }, [booking]);

  async function refreshBooking() {
    if (!isLoaded || !isSignedIn) return;
    if (!bookingId) return;
    try {
      const res = await fetch(`/api/account/bookings/${encodeURIComponent(bookingId)}`, { method: "GET" });
      const payload = (await res.json()) as { ok?: boolean; booking?: BookingDetail };
      if (!res.ok || !payload.ok || !payload.booking) return;
      setBooking(payload.booking);
    } catch {
      // ignore
    }
  }

  async function onConfirmCancel() {
    if (cancelSubmitting) return;
    if (!bookingId) return;
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/account/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: "PATCH" });
      const payload = (await res.json()) as { ok?: boolean; error?: string; booking?: { status?: string } };
      if (!res.ok || !payload.ok) {
        if (payload.error === "TOO_LATE") {
          setCancelError("Annulation possible jusqu’à 24h avant le début de la prestation.");
          return;
        }
        if (payload.error === "CANNOT_CANCEL_TOO_LATE") {
          setCancelError("Cette réservation est confirmée et ne peut plus être annulée en ligne (moins de 24h avant le début).");
          return;
        }
        if (payload.error === "MISSING_START_DATE") {
          setCancelError("Impossible d’annuler cette réservation (date de début manquante). Contacte le support.");
          return;
        }
        if (payload.error === "ALREADY_COMPLETED") {
          setCancelError("Impossible d’annuler une réservation déjà terminée.");
          return;
        }
        if (payload.error === "ALREADY_CANCELED") {
          setCancelError("Cette réservation est déjà annulée.");
          return;
        }
        if (payload.error === "FORBIDDEN") {
          setCancelError("Accès refusé.");
          return;
        }
        if (payload.error === "MISSING_PAYMENT_INTENT") {
          setCancelError("Impossible de rembourser cette réservation (paiement introuvable). Contacte le support.");
          return;
        }
        if (payload.error === "MISSING_CHARGE") {
          setCancelError("Impossible de rembourser cette réservation (charge Stripe introuvable). Contacte le support.");
          return;
        }
        if (payload.error === "REFUND_FAILED") {
          setCancelError("La réservation a été annulée, mais le remboursement a échoué. Contacte le support.");
          return;
        }
        if (payload.error === "INVALID_STATUS") {
          setCancelError("Impossible d’annuler cette réservation (statut invalide). Réessaie ou contacte le support.");
          return;
        }
        setCancelError("Impossible d’annuler la réservation. Réessaie.");
        return;
      }

      await refreshBooking();
      router.refresh();
      setCancelOpen(false);
      const nextStatus = String(payload.booking?.status ?? "");
      if (nextStatus === "REFUNDED") setToast("Réservation annulée et remboursée");
      else setToast("Réservation annulée");
    } catch {
      setCancelError("Impossible d’annuler la réservation. Réessaie.");
    } finally {
      setCancelSubmitting(false);
    }
  }

  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
        <p className="text-sm font-semibold text-slate-900">Connexion requise (401).</p>
        <p className="mt-2 text-sm text-slate-600">Connecte-toi pour accéder au détail de ta réservation.</p>
        <div className="mt-5">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-600">Réservations</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Détails</h1>
        </div>
        <Link href="/account/bookings" className="text-sm font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
          ← Retour
        </Link>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-900 sm:p-8">
          <p>{error}</p>
          {error.includes("401") ? (
            <Link
              href="/login"
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
            >
              Se connecter
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void loadBooking()}
              className="mt-4 inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50"
            >
              Réessayer
            </button>
          )}
        </div>
      ) : null}

      {loading || !booking || !computed ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold text-slate-900">Chargement…</p>
          <p className="mt-2 text-sm text-slate-600">Nous récupérons les détails de ta réservation.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="grid gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
                    {booking.sitter.avatarUrl && avatarIsSafe(booking.sitter.avatarUrl) ? (
                      <Image src={booking.sitter.avatarUrl} alt={booking.sitter.name} fill className="object-cover" sizes="56px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-base font-semibold text-slate-600">
                        {initialForName(booking.sitter.name)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{booking.sitter.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{computed.service}</p>
                    {sitterLocation(booking.sitter) ? (
                      <p className="mt-1 text-sm text-slate-600">{sitterLocation(booking.sitter)}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusPill status={computed.normalizedStatus} />
                  {!computed.cancelHidden ? (
                    <button
                      type="button"
                      disabled={!computed.cancellable}
                      title={cancelTooltip(booking, computed.cancellable)}
                      onClick={() => {
                        if (!computed.cancellable) return;
                        setCancelError(null);
                        setCancelOpen(true);
                      }}
                      className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Annuler la réservation
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    {computed.pricingUnit === "HOURLY" ? <Clock3 className="h-4 w-4" aria-hidden="true" /> : <CalendarDays className="h-4 w-4" aria-hidden="true" />}
                    <span>{computed.pricingUnit === "HOURLY" ? "Horaire" : "Journalier"}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{computed.dateLine}</p>
                </div>

                {booking.message?.trim() ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold text-slate-600">Message</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{booking.message}</p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold text-slate-600">Référence</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{booking.id}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
            <p className="text-sm font-semibold text-slate-900">Montants</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between text-slate-700">
                <span>Sous-total</span>
                <span className="font-semibold text-slate-900">{formatChfCents(computed.amount)}</span>
              </div>
              {computed.fee > 0 ? (
                <div className="flex items-center justify-between text-slate-700">
                  <span>Frais de service</span>
                  <span className="font-semibold text-slate-900">{formatChfCents(computed.fee)}</span>
                </div>
              ) : null}
              <div className="h-px bg-slate-200" />
              <div className="flex items-center justify-between">
                <span className="text-slate-700">Total</span>
                <span className="text-base font-semibold text-slate-900">{formatChfCents(computed.total)}</span>
              </div>
              <p className="text-xs text-slate-500">Devise: {(booking.currency ?? "chf").toUpperCase()}</p>
            </div>

            {computed.canPay ? (
              <Link
                href={`/checkout/${encodeURIComponent(booking.id)}`}
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
              >
                Payer
              </Link>
            ) : null}

            {booking.stripePaymentIntentId ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-600">Référence de paiement</p>
                <p className="mt-1 break-all text-xs font-medium text-slate-700">{booking.stripePaymentIntentId}</p>
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Laisser un avis</p>
                  <p className="mt-1 text-sm text-slate-600">Votre avis aide la communauté DogShift.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewOpen((v) => !v)}
                  className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  {reviewOpen ? "Masquer" : "Ouvrir"}
                </button>
              </div>

              {reviewOpen ? (
                <div className="mt-4">
                  {eligibilityLoading ? (
                    <p className="text-sm font-medium text-slate-600">Chargement…</p>
                  ) : eligibility?.ok && eligibility.eligible ? (
                    <div className="space-y-4">
                      {eligibility.alreadyReviewed && !eligibility.canEdit ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">Merci, avis déjà envoyé</p>
                          <p className="mt-1 text-sm text-slate-600">Cet avis est en lecture seule.</p>
                        </div>
                      ) : null}

                      {reviewSent ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <p className="text-sm font-semibold text-emerald-900">Merci pour votre avis</p>
                          <p className="mt-1 text-sm text-emerald-900/80">Il a bien été enregistré.</p>
                        </div>
                      ) : null}

                      {reviewError ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                          {reviewError}
                        </div>
                      ) : null}

                      {reviewLoading ? (
                        <p className="text-sm font-medium text-slate-600">Chargement…</p>
                      ) : null}

                      <div>
                        <p className="text-sm font-medium text-slate-700">Note *</p>
                        <div className="mt-2 flex items-center gap-2">
                          {Array.from({ length: 5 }).map((_, idx) => {
                            const v = idx + 1;
                            const active = rating >= v;
                            return (
                              <button
                                key={v}
                                type="button"
                                onClick={() => {
                                  if (eligibility.alreadyReviewed && !eligibility.canEdit) return;
                                  setRating(v);
                                }}
                                disabled={eligibility.alreadyReviewed && !eligibility.canEdit}
                                className={
                                  active
                                    ? "inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[#F5B301] ring-1 ring-slate-200 transition"
                                    : "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-300 ring-1 ring-slate-200 transition hover:bg-slate-50"
                                }
                                aria-label={`Donner ${v} étoile${v > 1 ? "s" : ""}`}
                              >
                                <Star className="h-5 w-5" />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="review_comment" className="block text-sm font-medium text-slate-700">
                          Commentaire (optionnel)
                        </label>
                        <textarea
                          id="review_comment"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          disabled={eligibility.alreadyReviewed && !eligibility.canEdit}
                          className="mt-2 w-full min-h-[120px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)] disabled:opacity-60"
                          placeholder="Partagez votre expérience (optionnel)"
                        />
                      </div>

                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={anonymous}
                          onChange={(e) => setAnonymous(e.target.checked)}
                          disabled={eligibility.alreadyReviewed && !eligibility.canEdit}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Publier de manière anonyme
                      </label>

                      <button
                        type="button"
                        disabled={rating < 1 || reviewSubmitting || (eligibility.alreadyReviewed && !eligibility.canEdit)}
                        onClick={async () => {
                          if (reviewSubmitting) return;
                          if (rating < 1) return;
                          setReviewSubmitting(true);
                          setReviewError(null);
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
                              setReviewError("Impossible d’envoyer l’avis. Réessaie.");
                              return;
                            }
                            setExistingReview(payload.review);
                            setReviewSent(true);
                          } catch {
                            setReviewError("Impossible d’envoyer l’avis. Réessaie.");
                          } finally {
                            setReviewSubmitting(false);
                          }
                        }}
                        className="w-full rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reviewSubmitting
                          ? "Envoi…"
                          : eligibility.alreadyReviewed
                            ? "Mettre à jour mon avis"
                            : "Envoyer l’avis"}
                      </button>

                      {existingReview ? (
                        <p className="text-xs font-medium text-slate-500">
                          Dernière mise à jour : {formatDateOnly(existingReview.updatedAt)}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-600">Vous pourrez laisser un avis après la prestation.</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {cancelOpen && booking && computed ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => {
              if (cancelSubmitting) return;
              setCancelOpen(false);
            }}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-8">
            <p className="text-lg font-semibold text-slate-900">Annuler cette réservation ?</p>
            <p className="mt-2 text-sm text-slate-600">Cette action est irréversible.</p>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{computed.service}</p>
              <p className="mt-1 text-sm text-slate-600">{computed.dateLine}</p>
            </div>

            {cancelError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                {cancelError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => setCancelOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={cancelSubmitting}
                onClick={() => void onConfirmCancel()}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelSubmitting ? "Annulation…" : "Confirmer l’annulation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.35)]">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
