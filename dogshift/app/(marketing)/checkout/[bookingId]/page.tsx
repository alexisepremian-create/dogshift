/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

import PageLoader from "@/components/ui/PageLoader";

const TravelMap = dynamic(() => import("@/components/TravelMap").then((m) => ({ default: m.TravelMap })), { ssr: false });

import { useMaintenance } from "@/components/platform/MaintenanceProvider";
import {
  cancellationPolicyVariantFromStartMs,
  type CancellationPolicyVariant,
} from "@/lib/reservation/cancellationPolicyUi";
import { maintenanceBookingUserMessage } from "@/lib/platform/maintenanceConstants";

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
  locationMode?: string | null;
  travelDistanceKm?: number | null;
  travelFeeAmount?: number | null;
  ownerLat?: number | null;
  ownerLng?: number | null;
  ownerAddress?: string | null;
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

function SummaryRow({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 text-sm">
      <p className="text-slate-600">{label}</p>
      <p className="text-right font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function CancellationPolicyEncart({ variant }: { variant: CancellationPolicyVariant }) {
  const isLastMinute = variant === "lastMinute";
  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed ${
        isLastMinute ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-800"
      }`}
      role="note"
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {isLastMinute ? (
          <AlertTriangle className="h-5 w-5 text-amber-700" strokeWidth={2} />
        ) : (
          <Info className="h-5 w-5 text-slate-600" strokeWidth={2} />
        )}
      </span>
      <div className="min-w-0 space-y-1.5">
        {isLastMinute ? (
          <>
            <p className="font-semibold">Réservation de dernière minute :</p>
            <p>confirmation immédiate après paiement et non remboursable, sauf si le dogsitter annule.</p>
          </>
        ) : (
          <>
            <p>Annulation gratuite jusqu’à 24h avant la prestation.</p>
            <p>Passé ce délai, la réservation n’est plus remboursable, sauf si le dogsitter annule.</p>
          </>
        )}
      </div>
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Info"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-slate-400 transition hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
      >
        ⓘ
      </button>
      {open ? (
        <span className="absolute left-1/2 top-full z-20 mt-2 w-[min(280px,calc(100vw-48px))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 text-xs font-medium leading-relaxed text-slate-700 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.25)]">
          {text}
        </span>
      ) : null}
    </span>
  );
}

function CheckoutForm({
  bookingId,
  cancellationPolicyVariant,
  ExpressCheckoutElement,
  PaymentElement,
  useStripe,
  useElements,
  noCard = false,
}: {
  bookingId: string;
  cancellationPolicyVariant: CancellationPolicyVariant;
  ExpressCheckoutElement?: any;
  PaymentElement: any;
  useStripe: () => StripeInstance | null;
  useElements: () => StripeElements | null;
  noCard?: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expressApplePayReady, setExpressApplePayReady] = useState<boolean | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  function routeAfterPaymentStatus(status?: string | null) {
    const safeBookingId = encodeURIComponent(bookingId);
    if (status === "succeeded") {
      router.push(`/paiement/success?bookingId=${safeBookingId}`);
      return;
    }
    if (status === "processing" || status === "requires_action" || status === "requires_capture") {
      router.push(`/paiement/pending?bookingId=${safeBookingId}`);
      return;
    }
    if (status === "canceled") {
      router.push(`/paiement/failed?bookingId=${safeBookingId}&reason=cancelled`);
      return;
    }
    if (status === "requires_payment_method") {
      router.push(`/paiement/failed?bookingId=${safeBookingId}&reason=failed`);
      return;
    }
    router.push(`/paiement/pending?bookingId=${safeBookingId}`);
  }

  async function onPay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    try {
      const returnUrl = `${window.location.origin}/paiement/retour?bookingId=${encodeURIComponent(bookingId)}`;
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
      });

      if (result.error) {
        setError(result.error.message ?? "Paiement impossible. Réessayez.");
        setSubmitting(false);
        return;
      }

      routeAfterPaymentStatus(result.paymentIntent?.status ?? null);
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
      const returnUrl = `${window.location.origin}/paiement/retour?bookingId=${encodeURIComponent(bookingId)}`;
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setError(result.error.message ?? "Paiement impossible. Réessayez.");
        setSubmitting(false);
        return;
      }

      routeAfterPaymentStatus(result.paymentIntent?.status ?? null);
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
        klarna: "never" as const,
        link: "never" as const,
        paypal: "never" as const,
      },
      buttonType: {
        applePay: "check-out" as const,
      },
      layout: {
        maxColumns: 2,
        maxRows: 1,
        overflow: "auto" as const,
      },
    }),
    []
  );

  const paymentElementOptions = useMemo(
    () => ({
      layout: "tabs" as const,
      paymentMethodOrder: ["twint", "card"],
      wallets: {
        applePay: "never" as const,
        googlePay: "never" as const,
      },
    }),
    []
  );

  const inner = (
    <>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Paiement sécurisé</h2>
        <p className="mt-1 text-sm text-slate-600">Choisis ton moyen de paiement pour finaliser la réservation.</p>
      </div>
      <div className="mt-5">
        <CancellationPolicyEncart variant={cancellationPolicyVariant} />
      </div>

      <div className="mt-5 space-y-3">
        {expressApplePayReady ? (
          <div className="w-full">
            {ExpressCheckoutElement ? (
              <ExpressCheckoutElement
                options={expressCheckoutOptions}
                onConfirm={() => void onExpressConfirm()}
                onReady={(event: any) => {
                  setExpressApplePayReady(Boolean(event?.availablePaymentMethods?.applePay));
                }}
              />
            ) : null}
          </div>
        ) : ExpressCheckoutElement && expressApplePayReady === null ? (
          <div className="hidden">
            <ExpressCheckoutElement
              options={expressCheckoutOptions}
              onConfirm={() => void onExpressConfirm()}
              onReady={(event: any) => {
                setExpressApplePayReady(Boolean(event?.availablePaymentMethods?.applePay));
              }}
            />
          </div>
        ) : null}

        <div className="w-full">
          <PaymentElement options={paymentElementOptions} />
        </div>
      </div>
      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}

      {/* CGU acceptance — required before payment (Swiss CO art. 1 / nLPD) */}
      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none cursor-pointer rounded border-slate-300 accent-[var(--dogshift-blue)]"
          aria-label="J'accepte les conditions d'utilisation et la politique d'annulation"
        />
        <span className="text-xs leading-relaxed text-slate-600">
          J&apos;ai lu et j&apos;accepte les{" "}
          <a href="/cgu" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-900">
            Conditions d&apos;utilisation
          </a>{" "}
          et la{" "}
          <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-900">
            Politique de confidentialité
          </a>
          , ainsi que la politique d&apos;annulation applicable à ma réservation.
        </span>
      </label>

      <button
        type="button"
        disabled={!stripe || !elements || submitting || !termsAccepted}
        onClick={() => void onPay()}
        className={`mt-4 w-full ${PRIMARY_BTN}`}
      >
        {submitting ? "Paiement…" : "Payer"}
      </button>
      <p className="mt-3 text-xs text-slate-500">Aucun débit imprévu. Le total affiché inclut les frais de paiement estimés.</p>
    </>
  );

  if (noCard) return inner;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
      {inner}
    </div>
  );
}

export default function CheckoutBookingPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = typeof params?.bookingId === "string" ? params.bookingId : "";
  const { maintenanceMode, adminNote, loading: maintLoading } = useMaintenance();

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
  const [paymentFeeAmount, setPaymentFeeAmount] = useState<number>(0);
  const [totalOwnerAmount, setTotalOwnerAmount] = useState<number>(0);
  const [sitterLat, setSitterLat] = useState<number | null>(null);
  const [sitterLng, setSitterLng] = useState<number | null>(null);

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

        if (!maintLoading && maintenanceMode) {
          setClientSecret(null);
          setError(maintenanceBookingUserMessage(adminNote));
          setLoading(false);
          return;
        }
        if (maintLoading) {
          return;
        }

        const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, { cache: "no-store" });
        const payload = (await res.json()) as { ok?: boolean; booking?: BookingDto; error?: string };
        if (canceled) return;
        if (!res.ok || !payload.ok || !payload.booking) {
          setError("Réservation introuvable.");
          setLoading(false);
          return;
        }

        setBooking(payload.booking);

        // Fetch sitter coordinates for travel map
        if (payload.booking.locationMode === "AT_OWNER" && payload.booking.sitterId) {
          try {
            const sitterRes = await fetch(`/api/sitters/${encodeURIComponent(payload.booking.sitterId)}`, { cache: "no-store" });
            const sitterPayload = (await sitterRes.json()) as { ok?: boolean; sitter?: { lat?: number | null; lng?: number | null } };
            if (sitterPayload.ok && sitterPayload.sitter) {
              if (typeof sitterPayload.sitter.lat === "number") setSitterLat(sitterPayload.sitter.lat);
              if (typeof sitterPayload.sitter.lng === "number") setSitterLng(sitterPayload.sitter.lng);
            }
          } catch {
            // non-blocking
          }
        }

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
          message?: string;
          paymentFeeAmount?: number;
          totalOwnerAmount?: number;
          reused?: boolean;
        };
        if (canceled) return;
        if (piRes.status === 503 || piPayload.error === "MAINTENANCE") {
          setClientSecret(null);
          setError(maintenanceBookingUserMessage(adminNote));
          setLoading(false);
          return;
        }
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

        if (process.env.NODE_ENV !== "production") {
          console.log("[checkout][payment-intent]", {
            bookingId,
            bookingAmount: payload.booking.amount,
            intentId: piPayload.intentId,
            livemode: piPayload.livemode,
            reused: Boolean(piPayload.reused),
            paymentFeeAmount: piPayload.paymentFeeAmount,
            totalOwnerAmount: piPayload.totalOwnerAmount,
          });
        }

        setClientSecret(piPayload.clientSecret);
        setPaymentFeeAmount(typeof piPayload.paymentFeeAmount === "number" ? piPayload.paymentFeeAmount : 0);
        setTotalOwnerAmount(
          typeof piPayload.totalOwnerAmount === "number" && Number.isFinite(piPayload.totalOwnerAmount)
            ? piPayload.totalOwnerAmount
            : payload.booking.amount
        );
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
  }, [adminNote, bookingId, maintLoading, maintenanceMode]);

  const canRender = useMemo(
    () => Boolean(clientSecret && stripeUi && !stripeUiError && !maintenanceMode),
    [clientSecret, stripeUi, stripeUiError, maintenanceMode]
  );

  const stripeAppearance = useMemo(
    () => ({
      theme: "stripe" as const,
      variables: {
        borderRadius: "16px",
        spacingUnit: "4px",
      },
      rules: {
        ".Tab": {
          border: "1px solid #E2E8F0",
          boxShadow: "none",
          borderRadius: "12px",
          padding: "12px 14px",
          minHeight: "44px",
        },
        ".Tab:hover": {
          color: "#0F172A",
        },
        ".Tab--selected": {
          borderColor: "#2563EB",
          boxShadow: "inset 0 0 0 1px #2563EB",
        },
        ".TabIcon": {
          width: "18px",
        },
        ".TabLabel": {
          fontWeight: "600",
        },
      },
    }),
    []
  );
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

  const checkoutCancellationVariant = useMemo(() => {
    if (!booking?.startDate) return "standard" as const;
    const startMs = new Date(booking.startDate).getTime();
    return cancellationPolicyVariantFromStartMs(Number.isFinite(startMs) ? startMs : null);
  }, [booking?.startDate]);

  const ElementsComp = stripeUi?.Elements as any;
  const ExpressCheckoutElementComp = stripeUi?.ExpressCheckoutElement as any;
  const PaymentElementComp = stripeUi?.PaymentElement as any;
  const useStripeHook = (stripeUi?.useStripe ?? (() => null)) as () => StripeInstance | null;
  const useElementsHook = (stripeUi?.useElements ?? (() => null)) as () => StripeElements | null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto max-w-[1100px] px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Confirmer et payer</h1>
              {booking && (
                <p className="mt-1.5 text-sm text-slate-500 truncate">
                  {[
                    booking.service,
                    isHourlyBooking ? bookingDateLabel : null,
                    isHourlyBooking ? bookingTimeRangeLabel : null,
                    !isHourlyBooking && booking.startDate ? formatDateLabel(booking.startDate) : null,
                    !isHourlyBooking && booking.endDate ? `→ ${formatDateLabel(booking.endDate)}` : null,
                  ].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <Link
              href={booking?.sitterId ? `/sitter/${booking.sitterId}` : "/search"}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              ← Retour
            </Link>
          </div>

          {loading ? (
            <PageLoader static />
          ) : error ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
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
            <div className="mt-7">
              {/* Unified card: Récapitulatif (left) + Paiement sécurisé (right) */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] lg:flex lg:items-stretch">

                {/* LEFT — Récapitulatif */}
                <div className="p-6 sm:p-8 lg:w-[44%] lg:border-r lg:border-slate-200">
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

                  {booking.locationMode === "AT_OWNER" &&
                    booking.ownerLat &&
                    booking.ownerLng &&
                    sitterLat &&
                    sitterLng &&
                    booking.travelDistanceKm &&
                    booking.travelFeeAmount ? (
                    <div className="mt-5">
                      <TravelMap
                        sitterLat={sitterLat}
                        sitterLng={sitterLng}
                        ownerLat={booking.ownerLat}
                        ownerLng={booking.ownerLng}
                        distanceKm={booking.travelDistanceKm}
                        feeCents={booking.travelFeeAmount}
                        compact
                      />
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <SummaryRow label="Sous-total" value={formatCents(booking.amount - (booking.travelFeeAmount ?? 0))} />
                    {booking.travelFeeAmount ? (
                      <>
                        <div className="mt-2" />
                        <SummaryRow label="Frais de déplacement" value={formatCents(booking.travelFeeAmount)} />
                      </>
                    ) : null}
                    <div className="mt-2" />
                    <SummaryRow
                      label={
                        <span className="inline-flex items-center gap-2">
                          <span>Frais de paiement (estimés)</span>
                          <InfoTooltip text="Ces frais correspondent aux coûts de traitement du paiement (ex: carte bancaire). Ils peuvent légèrement varier selon le moyen de paiement utilisé." />
                        </span>
                      }
                      value={formatCents(paymentFeeAmount)}
                    />
                    <div className="mt-4 h-px w-full bg-slate-200" />
                    <div className="mt-4 flex items-start justify-between gap-6">
                      <p className="text-sm font-semibold text-slate-900">Total</p>
                      <p className="text-right text-lg font-semibold tracking-tight text-slate-900">{formatCents(totalOwnerAmount)}</p>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Devise: CHF</p>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Support</p>
                    <p className="mt-1 text-sm text-slate-600">Besoin d&apos;aide ? Contacte-nous.</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">support@dogshift.ch</p>
                  </div>
                </div>

                {/* Mobile divider */}
                <div className="h-px w-full bg-slate-200 lg:hidden" />

                {/* RIGHT — Paiement sécurisé */}
                <div className="flex-1 p-6 sm:p-8">
                  {canRender ? (
                    <ElementsComp stripe={stripeUi!.stripePromise} options={stripeElementsOptions!}>
                      <CheckoutForm
                        bookingId={booking.id}
                        cancellationPolicyVariant={checkoutCancellationVariant}
                        ExpressCheckoutElement={ExpressCheckoutElementComp}
                        PaymentElement={PaymentElementComp}
                        useStripe={useStripeHook}
                        useElements={useElementsHook}
                        noCard
                      />
                    </ElementsComp>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Stripe</p>
                      <p className="mt-2 text-sm text-rose-600">{stripeUiError ?? "Impossible de charger Stripe."}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
