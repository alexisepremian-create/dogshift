"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
  sitter: { sitterId: string; name: string; avatarUrl: string | null };
};

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

  const startIso = booking.startDate;
  if (!startIso) return true;
  const startTs = new Date(startIso).getTime();
  if (!Number.isFinite(startTs)) return true;

  const limit = startTs - 24 * 60 * 60 * 1000;
  return Date.now() <= limit;
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
  const { isLoaded, isSignedIn } = useUser();

  const bookingId = typeof params?.id === "string" ? params.id : "";

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        if (payload.error === "TOO_LATE") {
          setCancelError("Impossible d’annuler une réservation déjà imminente (moins de 24h avant le début). ");
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
        setCancelError("Impossible d’annuler la réservation. Réessaie.");
        return;
      }

      await refreshBooking();
      setCancelOpen(false);
      setToast("Réservation annulée");
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
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusPill status={computed.normalizedStatus} />
                  {computed.cancellable ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelError(null);
                        setCancelOpen(true);
                      }}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                    >
                      Annuler
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

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-600">PaymentIntent</p>
              <p className="mt-1 break-all text-xs font-medium text-slate-700">{booking.stripePaymentIntentId ?? "—"}</p>
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
