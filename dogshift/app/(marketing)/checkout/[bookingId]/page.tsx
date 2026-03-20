"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type BookingStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PAID"
  | "CONFIRMED"
  | "PAYMENT_FAILED"
  | "CANCELLED";

type BookingDto = {
  id: string;
  sitterId: string;
  status: BookingStatus;
  amount: number;
  currency: string;
  service?: string;
  startDate?: string;
  endDate?: string;
};

type StripeElements = any;
type StripeInstance = any;

const PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50";
const PAYMENT_OPTION_CARD =
  "flex w-full min-h-[88px] items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:bg-slate-50";

function formatCents(amount: number) {
  return `CHF ${(amount / 100).toFixed(2)}`;
}

function estimateServiceFeeCents(totalCents: number) {
  void totalCents;
  return 0;
}

function formatDateLabel(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-CH", { weekday: "short", day: "2-digit", month: "short" });
}

function formatDateLongLabel(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(d);
}

function formatDateTimeLabel(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-CH", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d).replace(", ", " – ");
}

function formatTimeLabel(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-CH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 text-sm">
      <p className="text-slate-600">{label}</p>
      <p className="text-right font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function CheckoutForm({
  bookingId,
  ExpressCheckoutElement,
  PaymentElement,
  useStripe,
  useElements,
}: {
  bookingId: string;
  ExpressCheckoutElement?: any;
  PaymentElement: any;
  useStripe: () => StripeInstance | null;
  useElements: () => StripeElements | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expressReady, setExpressReady] = useState(false);

  async function onPay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/paiement/success?bookingId=${encodeURIComponent(bookingId)}`,
        },
      });

      if (result.error) {
        setError(result.error.message ?? "Paiement impossible. Réessayez.");
        setSubmitting(false);
        return;
      }

      router.push(`/paiement/success?bookingId=${encodeURIComponent(bookingId)}`);
    } catch {
      setError("Paiement impossible. Réessayez.");
      setSubmitting(false);
    }
  }

  async function onExpressConfirm() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/paiement/success?bookingId=${encodeURIComponent(bookingId)}`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setError(result.error.message ?? "Paiement impossible. Réessayez.");
        setSubmitting(false);
        return;
      }

      router.push(`/paiement/success?bookingId=${encodeURIComponent(bookingId)}`);
    } catch {
      setError("Paiement impossible. Réessayez.");
      setSubmitting(false);
    }
  }

  const expressCheckoutOptions = useMemo(
    () => ({
      buttonHeight: 52,
      paymentMethods: {
        applePay: "always" as const,
        googlePay: "never" as const,
        amazonPay: "never" as const,
        link: "never" as const,
        paypal: "never" as const,
      },
      buttonType: {
        applePay: "check-out" as const,
      },
      layout: {
        maxColumns: 2,
        maxRows: 2,
        overflow: "auto" as const,
      },
    }),
    []
  );

  const paymentElementOptions = useMemo(
    () => ({
      layout: "tabs" as const,
      paymentMethodOrder: ["twint", "klarna", "card"],
    }),
    []
  );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Paiement sécurisé</h2>
          <p className="mt-1 text-sm text-slate-600">Choisis le moyen de paiement le plus rapide pour finaliser ta réservation.</p>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <p className="text-sm font-semibold text-slate-900">Choisis ton moyen de paiement</p>
        <div className="mt-4 space-y-3">
          <div className={PAYMENT_OPTION_CARD + " p-3"}>
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Paiement rapide</span>
              <span className="mt-1 block text-sm font-semibold text-slate-900">Apple Pay</span>
            </div>
            <div className="w-[160px] shrink-0">
              {ExpressCheckoutElement ? (
                <ExpressCheckoutElement
                  options={expressCheckoutOptions}
                  onConfirm={() => void onExpressConfirm()}
                  onReady={(event: any) => {
                    setExpressReady(Boolean(event?.availablePaymentMethods?.applePay));
                  }}
                />
              ) : (
                <div className="flex h-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-400">
                  Indisponible
                </div>
              )}
            </div>
          </div>

          <div className={PAYMENT_OPTION_CARD + " block p-4"}>
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">TWINT</span>
              <span className="mt-1 block text-sm font-semibold text-slate-900">TWINT</span>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <PaymentElement options={paymentElementOptions} />
            </div>
          </div>
        </div>
      </div>
      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
      <button
        type="button"
        disabled={!stripe || !elements || submitting}
        onClick={() => void onPay()}
        className={`mt-6 w-full ${PRIMARY_BTN}`}
      >
        {submitting ? "Paiement…" : "Payer"}
      </button>
      <p className="mt-3 text-xs text-slate-500">Aucun débit imprévu. Le montant affiché correspond exactement à votre réservation.</p>
    </div>
  );
}

export default function CheckoutBookingPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = typeof params?.bookingId === "string" ? params.bookingId : "";

  const [stripeUi, setStripeUi] = useState<{
    stripePromise: Promise<any>;
    Elements: any;
    ExpressCheckoutElement: any;
    PaymentElement: any;
    useStripe: () => StripeInstance | null;
    useElements: () => StripeElements | null;
  } | null>(null);
  const [stripeUiError, setStripeUiError] = useState<string | null>(null);

  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    (async () => {
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
      if (!publishableKey) {
        setStripeUiError("Variable manquante: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
        return;
      }

      try {
        const stripeMod = await import("@stripe/stripe-js");
const stripeReact = await import("@stripe/react-stripe-js");
        if (canceled) return;

        setStripeUi({
          stripePromise: stripeMod.loadStripe(publishableKey),
          Elements: stripeReact.Elements,
          ExpressCheckoutElement: stripeReact.ExpressCheckoutElement,
          PaymentElement: stripeReact.PaymentElement,
          useStripe: stripeReact.useStripe,
          useElements: stripeReact.useElements,
        });
        setStripeUiError(null);
      } catch (e) {
        if (canceled) return;
        setStripeUiError(
          "Modules Stripe manquants. Lance: npm install (doit inclure @stripe/stripe-js + @stripe/react-stripe-js)."
        );
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    let canceled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { cache: "no-store" });
        const payload = (await res.json()) as { ok?: boolean; booking?: BookingDto; error?: string };
        if (canceled) return;
        if (!res.ok || !payload.ok || !payload.booking) {
          setError("Réservation introuvable.");
          setLoading(false);
          return;
        }

        setBooking(payload.booking);

        const piRes = await fetch("/api/stripe/payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });
        const piPayload = (await piRes.json()) as {
          ok?: boolean;
          clientSecret?: string | null;
          intentId?: string;
          livemode?: boolean;
          error?: string;
        };
        if (canceled) return;
        if (!piRes.ok || !piPayload.ok || typeof piPayload.clientSecret !== "string") {
          setError("Impossible d’initialiser le paiement.");
          setLoading(false);
          return;
        }

        if (typeof piPayload.intentId !== "string" || typeof piPayload.livemode !== "boolean") {
          setError("Paiement: réponse Stripe invalide (intentId/livemode manquant).");
          setLoading(false);
          return;
        }

        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
        if (!publishableKey) {
          setError("Variable manquante: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
          setLoading(false);
          return;
        }

        const pkIsLive = publishableKey.startsWith("pk_live_");
        const pkIsTest = publishableKey.startsWith("pk_test_");
        if (!pkIsLive && !pkIsTest) {
          setError("Clé Stripe publishable invalide: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (attendu pk_live_...)");
          setLoading(false);
          return;
        }
        if (pkIsLive !== piPayload.livemode) {
          setError(
            `Mix Stripe TEST/LIVE détecté. publishable=${pkIsLive ? "LIVE" : "TEST"} mais PaymentIntent=${
              piPayload.livemode ? "LIVE" : "TEST"
            } (intent ${piPayload.intentId}). Vérifie NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY et STRIPE_SECRET_KEY.`
          );
          setLoading(false);
          return;
        }

        setClientSecret(piPayload.clientSecret);
        setLoading(false);
      } catch {
        if (canceled) return;
        setError("Impossible de charger le checkout.");
        setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [bookingId]);

  const canRender = useMemo(() => Boolean(clientSecret && stripeUi && !stripeUiError), [clientSecret, stripeUi, stripeUiError]);

  const stripeAppearance = useMemo(() => ({ theme: "stripe" as const }), []);
  const stripeElementsOptions = useMemo(() => {
    if (!clientSecret) return null;
    return { clientSecret, appearance: stripeAppearance };
  }, [clientSecret, stripeAppearance]);

  const serviceFeeCents = useMemo(() => {
    if (!booking) return 0;
    return estimateServiceFeeCents(booking.amount);
  }, [booking]);

  const bookingStartLabel = useMemo(() => {
    if (!booking?.startDate) return "—";
    if (booking.service === "Promenade" || booking.service === "Garde") {
      return formatDateTimeLabel(booking.startDate);
    }
    return formatDateLabel(booking.startDate);
  }, [booking]);

  const bookingEndLabel = useMemo(() => {
    if (!booking?.endDate) return "—";
    if (booking.service === "Promenade" || booking.service === "Garde") {
      return formatDateTimeLabel(booking.endDate);
    }
    return formatDateLabel(booking.endDate);
  }, [booking]);

  const bookingDateLabel = useMemo(() => {
    if (!booking?.startDate) return "—";
    return formatDateLongLabel(booking.startDate);
  }, [booking]);

  const bookingTimeRangeLabel = useMemo(() => {
    if (!booking?.startDate || !booking?.endDate) return "—";
    return `${formatTimeLabel(booking.startDate)} – ${formatTimeLabel(booking.endDate)}`;
  }, [booking]);

  const isHourlyBooking = booking?.service === "Promenade" || booking?.service === "Garde";

  const ElementsComp = stripeUi?.Elements as any;
  const ExpressCheckoutElementComp = stripeUi?.ExpressCheckoutElement as any;
  const PaymentElementComp = stripeUi?.PaymentElement as any;
  const useStripeHook = (stripeUi?.useStripe ?? (() => null)) as () => StripeInstance | null;
  const useElementsHook = (stripeUi?.useElements ?? (() => null)) as () => StripeElements | null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Confirmer et payer</h1>
            </div>
            <Link
              href={booking?.sitterId ? `/sitter/${booking.sitterId}` : "/search"}
              className={SECONDARY_BTN}
            >
              Retour
            </Link>
          </div>

          {loading ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
                <div className="h-5 w-40 rounded bg-slate-100" />
                <div className="mt-4 h-20 w-full rounded-2xl bg-slate-50" />
                <div className="mt-3 h-20 w-full rounded-2xl bg-slate-50" />
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
                <div className="h-5 w-40 rounded bg-slate-100" />
                <div className="mt-4 h-40 w-full rounded-2xl bg-slate-50" />
              </div>
            </div>
          ) : error ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
              <p className="text-sm font-semibold text-slate-900">Impossible d’afficher le checkout</p>
              <p className="mt-2 text-sm text-rose-600">{error}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={booking?.sitterId ? `/sitter/${booking.sitterId}` : "/search"}
                  className={SECONDARY_BTN}
                >
                  Revenir en arrière
                </Link>
              </div>
            </div>
          ) : booking && clientSecret ? (
            <div className="mt-7 grid gap-6 lg:grid-cols-2">
              <div className="lg:sticky lg:top-8 lg:self-start">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">Récapitulatif</h2>
                  <p className="mt-1 text-sm text-slate-600">Vérifie les détails avant de payer.</p>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <SummaryRow label="Service" value={booking.service ?? "—"} />
                    <div className="mt-3 h-px w-full bg-slate-200" />
                    {isHourlyBooking ? (
                      <div className="mt-4 space-y-4">
                        <SummaryRow label="Date" value={bookingDateLabel} />
                        <SummaryRow label="Heure" value={bookingTimeRangeLabel} />
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <SummaryRow label="Début" value={bookingStartLabel} />
                        <SummaryRow label="Fin" value={bookingEndLabel} />
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
                    <SummaryRow label="Sous-total" value={formatCents(booking.amount)} />
                    <div className="mt-2" />
                    <SummaryRow label="Frais de service" value="0 CHF" />
                    <div className="mt-4 h-px w-full bg-slate-200" />
                    <div className="mt-4 flex items-start justify-between gap-6">
                      <p className="text-sm font-semibold text-slate-900">Total</p>
                      <p className="text-right text-lg font-semibold tracking-tight text-slate-900">{formatCents(booking.amount)}</p>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Devise: CHF</p>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
                  <p className="text-sm font-semibold text-slate-900">Support</p>
                  <p className="mt-2 text-sm text-slate-600">Besoin d’aide ? Écris-nous et on te répond rapidement.</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">support@dogshift.ch</p>
                  <p className="mt-1 text-xs text-slate-500">(ou via ton espace “Mon compte”)</p>
                </div>
              </div>

              {canRender ? (
                <ElementsComp stripe={stripeUi!.stripePromise} options={stripeElementsOptions!}>
                  <CheckoutForm
                    bookingId={booking.id}
                    ExpressCheckoutElement={ExpressCheckoutElementComp}
                    PaymentElement={PaymentElementComp}
                    useStripe={useStripeHook}
                    useElements={useElementsHook}
                  />
                </ElementsComp>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
                  <p className="text-sm font-semibold text-slate-900">Stripe</p>
                  <p className="mt-2 text-sm text-rose-600">{stripeUiError ?? "Impossible de charger Stripe."}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
