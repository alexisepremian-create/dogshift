"use client";

import Link from "next/link";
import { useMemo } from "react";

const PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]";
const SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50";

export default function PaymentFailedPage() {
  const params = useMemo(() => {
    if (typeof window === "undefined") return { bookingId: "", reason: "failed" };
    const sp = new URLSearchParams(window.location.search);
    return {
      bookingId: sp.get("bookingId") ?? "",
      reason: sp.get("reason") ?? "failed",
    };
  }, []);

  const title = params.reason === "cancelled" ? "Paiement annulé" : "Paiement échoué";
  const message =
    params.reason === "cancelled"
      ? "Le paiement a été annulé avant confirmation. Aucun paiement confirmé n’a été reçu."
      : "Le paiement n’a pas été confirmé par Stripe. Aucun paiement confirmé n’a été reçu.";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-3 text-sm text-slate-600">{message}</p>

          {params.bookingId ? (
            <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              bookingId: <span className="font-mono">{params.bookingId}</span>
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            {params.bookingId ? (
              <Link href={`/checkout/${encodeURIComponent(params.bookingId)}`} className={PRIMARY_BTN}>
                Réessayer le paiement
              </Link>
            ) : null}
            <Link href="/search" className={SECONDARY_BTN}>
              Retour aux sitters
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
