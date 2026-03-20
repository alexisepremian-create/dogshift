"use client";

import Link from "next/link";
import { useMemo } from "react";

const PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]";
const SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50";

export default function PaymentPendingPage() {
  const bookingId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("bookingId") ?? "";
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paiement en attente</h1>
          <p className="mt-3 text-sm text-slate-600">
            Le paiement a été initié, mais Stripe ne l’a pas encore confirmé. La réservation reste non bloquante tant que le paiement n’est pas validé.
          </p>

          {bookingId ? (
            <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              bookingId: <span className="font-mono">{bookingId}</span>
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            {bookingId ? (
              <Link href={`/checkout/${encodeURIComponent(bookingId)}`} className={PRIMARY_BTN}>
                Revenir au paiement
              </Link>
            ) : null}
            <Link href="/account/bookings" className={SECONDARY_BTN}>
              Mes réservations
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
