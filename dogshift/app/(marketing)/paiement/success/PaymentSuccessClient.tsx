"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BookingStatus = "DRAFT" | "PENDING_PAYMENT" | "PENDING_ACCEPTANCE" | "PAID" | "CONFIRMED" | "PAYMENT_FAILED" | "CANCELLED";

type BookingDto = {
  id: string;
  status: BookingStatus;
  amount: number;
  currency: string;
  createdAt: string;
};

const PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50";

function formatCents(amount: number) {
  return `CHF ${(amount / 100).toFixed(2)}`;
}

function Step({
  title,
  description,
  state,
}: {
  title: string;
  description: string;
  state: "done" | "current" | "todo" | "error";
}) {
  const dotClass =
    state === "done"
      ? "bg-emerald-500"
      : state === "current"
        ? "bg-[var(--dogshift-blue)]"
        : state === "error"
          ? "bg-rose-500"
          : "bg-slate-300";

  const ringClass =
    state === "current"
      ? "ring-4 ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
      : "";

  const titleClass = state === "todo" ? "text-slate-600" : "text-slate-900";

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 rounded-full ${dotClass} ${ringClass}`} />
        <div className="mt-2 h-full w-px bg-slate-200" />
      </div>
      <div className="pb-6">
        <p className={`text-sm font-semibold ${titleClass}`}>{title}</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );
}

export default function PaymentSuccessClient({ bookingId }: { bookingId: string }) {
  const initialBookingId = typeof bookingId === "string" ? bookingId : "";
  const [resolvedBookingId, setResolvedBookingId] = useState(initialBookingId);
  const [mounted, setMounted] = useState(false);

  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!resolvedBookingId) {
      const fromUrl = new URLSearchParams(window.location.search).get("bookingId") ?? "";
      if (fromUrl) {
        setResolvedBookingId(fromUrl);
        return;
      }

      setFinalizing(true);
      setLoading(false);
      setError("Réservation introuvable (bookingId manquant).");
      return;
    }

    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const startedAt = Date.now();

    function scheduleNextTick() {
      if (Date.now() - startedAt < 15_000) {
        timer = setTimeout(tick, 2000);
      } else {
        setError("Paiement en attente de confirmation. Merci de réactualiser.");
        setLoading(false);
        setFinalizing(true);
      }
    }

    async function tick() {
      try {
        const res = await fetch(`/api/bookings/${encodeURIComponent(resolvedBookingId)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        const payload = (await res.json()) as { ok?: boolean; booking?: BookingDto; error?: string };

        if (canceled) return;

        if (!res.ok || !payload?.ok || !payload.booking) {
          setFinalizing(true);
          scheduleNextTick();
          return;
        }

        const nextBooking = payload.booking;
        setBooking(nextBooking);
        setError(null);
        setLoading(false);

        const hasAmount = typeof nextBooking.amount === "number" && Number.isFinite(nextBooking.amount);
        const hasStatus = typeof nextBooking.status === "string";

        if (!hasAmount || !hasStatus || nextBooking.status === "PENDING_PAYMENT") {
          setFinalizing(true);
          scheduleNextTick();
          return;
        }

        if (
          nextBooking.status === "CONFIRMED" ||
          nextBooking.status === "PENDING_ACCEPTANCE" ||
          nextBooking.status === "PAID" ||
          nextBooking.status === "PAYMENT_FAILED" ||
          nextBooking.status === "CANCELLED"
        ) {
          setFinalizing(false);
        } else {
          setFinalizing(true);
        }
      } catch {
        if (canceled) return;
        setFinalizing(true);
        scheduleNextTick();
      }
    }

    tick();

    return () => {
      canceled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mounted, resolvedBookingId]);

  const headline = useMemo(() => {
    if (finalizing && !error && booking?.status !== "CONFIRMED" && booking?.status !== "PENDING_ACCEPTANCE" && booking?.status !== "PAID") {
      return "On finalise encore";
    }
    if (loading) return "Confirmation du paiement";
    if (error) return "On finalise encore";
    if (booking?.status === "CONFIRMED") return "Réservation confirmée";
    if (booking?.status === "PENDING_ACCEPTANCE" || booking?.status === "PAID") return "Paiement confirmé";
    if (booking?.status === "PAYMENT_FAILED") return "Paiement refusé";
    if (booking?.status === "CANCELLED") return "Paiement annulé";
    return "Confirmation du paiement";
  }, [booking?.status, error, finalizing, loading]);

  const subline = useMemo(() => {
    if (loading) return "On attend la confirmation finale (webhook Stripe).";
    if (error) return error;
    if (booking?.status === "CONFIRMED") return "Ta réservation est confirmée par le sitter. Tu peux revenir à l’annonce.";
    if (booking?.status === "PENDING_ACCEPTANCE" || booking?.status === "PAID") {
      return "Paiement validé. En attente de l’acceptation du sitter.";
    }
    if (booking?.status === "PAYMENT_FAILED") return "Aucun débit n’a été effectué. Tu peux réessayer.";
    if (booking?.status === "CANCELLED") return "Tu peux revenir à l’annonce et relancer une demande si besoin.";
    return "On attend la confirmation finale (webhook Stripe).";
  }, [booking?.status, error, loading]);

  const steps = useMemo(() => {
    const status = booking?.status;
    const failed = status === "PAYMENT_FAILED";
    const confirmed = status === "CONFIRMED";
    const paid = status === "PENDING_ACCEPTANCE" || status === "PAID";

    return {
      authorisation: confirmed || paid ? "done" : failed ? "error" : "done",
      confirmation: confirmed || paid ? "done" : failed ? "error" : "current",
      reservation: confirmed ? "done" : failed ? "todo" : paid ? "current" : "todo",
    } as const;
  }, [booking?.status]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto max-w-[1100px] px-4 py-14 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-10">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{headline}</h1>
                <p className="mt-2 text-sm text-slate-600">{subline}</p>
              </div>
              <div
                className={
                  booking?.status === "CONFIRMED"
                    ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                    : booking?.status === "PENDING_ACCEPTANCE" || booking?.status === "PAID"
                      ? "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                    : booking?.status === "PAYMENT_FAILED"
                      ? "rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
                      : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                }
              >
                {booking?.status ?? (loading ? "CONFIRMATION" : "ETAT")}
              </div>
            </div>

            <div className="mt-7">
              <Step
                title="Paiement autorisé"
                description="Le paiement a été initié depuis le checkout intégré."
                state={steps.authorisation}
              />
              <Step
                title="Confirmation Stripe"
                description="Nous attendons la confirmation via webhook (quelques secondes)."
                state={steps.confirmation}
              />
              <Step
                title="Réservation confirmée"
                description="La réservation est confirmée après acceptation du sitter."
                state={steps.reservation}
              />
            </div>

            <div className="mt-2 flex flex-wrap gap-3">
              {booking?.status === "PAYMENT_FAILED" ? (
                <Link href={`/checkout/${encodeURIComponent(resolvedBookingId)}`} className={PRIMARY_BTN}>
                  Réessayer le paiement
                </Link>
              ) : null}

              <Link href="/search" className={booking?.status === "PAYMENT_FAILED" ? SECONDARY_BTN : PRIMARY_BTN}>
                Retour aux sitters
              </Link>

              <Link href="/post-login" className={SECONDARY_BTN}>
                Aller à mon espace
              </Link>
            </div>
          </div>

          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-10">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Détails</h2>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-600">Montant</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{booking ? formatCents(booking.amount) : "—"}</p>
                <p className="mt-2 text-xs text-slate-500">Devise: CHF</p>
              </div>

              <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
                Référence: <span className="font-mono">{resolvedBookingId || "—"}</span>
              </p>

              <p className="mt-4 text-xs text-slate-500">
                Si ça bloque plus de 15s, rafraîchis la page : le webhook peut arriver avec un léger délai.
              </p>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-slate-900">Support</p>
                <p className="mt-2 text-sm text-slate-600">Une question sur le paiement ou la réservation ?</p>
                <p className="mt-3 text-sm font-semibold text-slate-900">support@dogshift.ch</p>
                <p className="mt-1 text-xs text-slate-500">On te répond au plus vite.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
