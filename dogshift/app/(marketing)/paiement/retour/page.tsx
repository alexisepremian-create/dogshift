"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function buildTarget(status: string | null, bookingId: string, redirectStatus: string) {
  const safeBookingId = encodeURIComponent(bookingId);
  if (status === "succeeded") return `/paiement/success?bookingId=${safeBookingId}`;
  if (status === "processing" || status === "requires_action" || status === "requires_capture") {
    return `/paiement/pending?bookingId=${safeBookingId}`;
  }
  if (status === "requires_payment_method" || status === "canceled") {
    const reason = redirectStatus === "failed" ? "cancelled" : "failed";
    return `/paiement/failed?bookingId=${safeBookingId}&reason=${reason}`;
  }
  return `/paiement/pending?bookingId=${safeBookingId}`;
}

export default function PaymentReturnPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    if (typeof window === "undefined") {
      return { bookingId: "", clientSecret: "", redirectStatus: "" };
    }
    const sp = new URLSearchParams(window.location.search);
    return {
      bookingId: sp.get("bookingId") ?? "",
      clientSecret: sp.get("payment_intent_client_secret") ?? "",
      redirectStatus: sp.get("redirect_status") ?? "",
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    (async () => {
      if (!params.bookingId) {
        setError("Retour de paiement invalide: bookingId manquant.");
        return;
      }

      if (!params.clientSecret) {
        if (params.redirectStatus === "failed") {
          router.replace(`/paiement/failed?bookingId=${encodeURIComponent(params.bookingId)}&reason=cancelled`);
          return;
        }
        router.replace(`/paiement/pending?bookingId=${encodeURIComponent(params.bookingId)}`);
        return;
      }

      try {
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
        if (!publishableKey) {
          setError("Variable manquante: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
          return;
        }

        const stripeMod = await import("@stripe/stripe-js");
        const stripe = await stripeMod.loadStripe(publishableKey);
        if (!stripe) {
          setError("Impossible d’initialiser Stripe.");
          return;
        }

        const result = await stripe.retrievePaymentIntent(params.clientSecret);
        if (canceled) return;

        if (result.error) {
          const reason = params.redirectStatus === "failed" ? "cancelled" : "failed";
          router.replace(`/paiement/failed?bookingId=${encodeURIComponent(params.bookingId)}&reason=${reason}`);
          return;
        }

        const target = buildTarget(result.paymentIntent?.status ?? null, params.bookingId, params.redirectStatus);
        router.replace(target);
      } catch {
        if (canceled) return;
        setError("Impossible de vérifier le statut du paiement.");
      }
    })();

    return () => {
      canceled = true;
    };
  }, [params.bookingId, params.clientSecret, params.redirectStatus, router]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Vérification du paiement</h1>
          <p className="mt-3 text-sm text-slate-600">
            Nous vérifions le statut réel du paiement auprès de Stripe avant d’afficher l’écran final.
          </p>
          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        </div>
      </main>
    </div>
  );
}
