"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function PaymentCancelPage() {
  const bookingId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("bookingId") ?? "";
  }, []);

  const [canceling, setCanceling] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    let canceled = false;

    (async () => {
      setCanceling(true);
      setError(null);
      try {
        const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const payload = (await res.json()) as { ok?: boolean; error?: string };
        if (canceled) return;
        if (!res.ok || !payload?.ok) {
          setError("Impossible d’annuler la réservation. Réessayez.");
          return;
        }
        setDone(true);
      } catch {
        if (canceled) return;
        setError("Impossible d’annuler la réservation. Réessayez.");
      } finally {
        if (!canceled) setCanceling(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [bookingId]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paiement annulé</h1>
          <p className="mt-3 text-sm text-slate-600">Le paiement a été annulé. Vous pouvez réessayer.</p>

          {bookingId ? (
            <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              bookingId: <span className="font-mono">{bookingId}</span>
            </p>
          ) : null}

          {canceling ? (
            <p className="mt-4 text-sm text-slate-700">Annulation en cours…</p>
          ) : error ? (
            <p className="mt-4 text-sm text-red-700">{error}</p>
          ) : done ? (
            <p className="mt-4 text-sm text-slate-700">Réservation annulée.</p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
            >
              Retour aux sitters
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Accueil
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
