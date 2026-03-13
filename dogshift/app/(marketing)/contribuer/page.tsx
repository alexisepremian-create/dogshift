"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function ContribuerPage({
  searchParams,
}: {
  searchParams?: { canceled?: string };
}) {
  const canceled = searchParams?.canceled === "1";
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  const amountToPay = useMemo(() => {
    if (!useCustomAmount) return selectedAmount;
    const parsed = Number(customAmount);
    if (!Number.isFinite(parsed)) return NaN;
    return Math.round(parsed);
  }, [customAmount, selectedAmount, useCustomAmount]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="space-y-4">
        <p className="text-xs font-semibold text-slate-600">Contribution</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Soutenir le lancement de DogShift
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
          DogShift est en phase pilote. Votre soutien est volontaire et aide à financer le développement, l’infrastructure et les outils nécessaires à une
          expérience fiable.
        </p>
        {canceled ? (
          <p className="text-sm font-medium text-slate-700">Paiement annulé — vous pouvez réessayer à tout moment.</p>
        ) : null}
      </div>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.16)] sm:p-8">
        <p className="text-xs font-semibold text-slate-600">Choisissez un montant</p>
        <p className="mt-2 text-sm text-slate-600">Vous serez redirigé vers Stripe Checkout dans le même onglet pour finaliser votre contribution.</p>

        <form action="/api/stripe/checkout" method="POST" className="mt-5">
          <div className="flex flex-wrap gap-2">
            {[5, 10, 20, 50, 100].map((amount) => {
              const active = !useCustomAmount && selectedAmount === amount;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setUseCustomAmount(false);
                    setSelectedAmount(amount);
                  }}
                  className={`inline-flex items-center justify-center rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] ${
                    active
                      ? "border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),transparent_90%)] text-slate-900"
                      : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {amount} CHF
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <input
                type="radio"
                name="contributionAmount"
                checked={useCustomAmount}
                onChange={() => setUseCustomAmount(true)}
              />
              Montant libre
            </label>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={customAmount}
                onChange={(e) => {
                  setUseCustomAmount(true);
                  setCustomAmount(e.target.value);
                }}
                className="w-32 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                placeholder="Ex: 25"
              />
              <span className="text-sm font-semibold text-slate-700">CHF</span>
              <span className="text-xs text-slate-500">min. 1 CHF</span>
            </div>
          </div>

          <input type="hidden" name="amount" value={Number.isFinite(amountToPay) ? String(amountToPay) : ""} />

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="submit"
              disabled={!(Number.isFinite(amountToPay) && amountToPay >= 1)}
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              Contribuer
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        >
          Retour à l’accueil
        </Link>
        <Link
          href="/help"
          className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        >
          Nous contacter
        </Link>
      </div>
    </main>
  );
}
