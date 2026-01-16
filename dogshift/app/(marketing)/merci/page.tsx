"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type SessionResponse =
  | {
      ok: true;
      amount_total: number | null;
      currency: string | null;
      payment_status: string | null;
      customer_email: string | null;
    }
  | { ok: false; error: string };

function formatAmount(amountTotal: number | null, currency: string | null) {
  if (typeof amountTotal !== "number" || !Number.isFinite(amountTotal)) return "—";
  const currencyUpper = typeof currency === "string" && currency ? currency.toUpperCase() : "CHF";
  const amount = (amountTotal / 100).toFixed(0);
  return `${amount} ${currencyUpper}`;
}

export default function MerciPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";

  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [data, setData] = useState<SessionResponse | null>(null);

  const canFetch = useMemo(() => sessionId.startsWith("cs_") && sessionId.length <= 200, [sessionId]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!canFetch) {
        setState("error");
        setData({ ok: false, error: "INVALID_SESSION_ID" });
        return;
      }

      setState("loading");

      const res = await fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`);
      const json = (await res.json().catch(() => null)) as SessionResponse | null;

      if (!mounted) return;
      if (!res.ok || !json) {
        setState("error");
        setData({ ok: false, error: "SESSION_NOT_FOUND" });
        return;
      }

      setState("success");
      setData(json);
    }

    run().catch((err) => {
      console.error("[merci] fetch session error", err);
      if (!mounted) return;
      setState("error");
      setData({ ok: false, error: "INTERNAL_ERROR" });
    });

    return () => {
      mounted = false;
    };
  }, [canFetch, sessionId]);

  const paymentStatus = data && (data as any).ok ? (data as any).payment_status : null;
  const amountLabel = data && (data as any).ok ? formatAmount((data as any).amount_total, (data as any).currency) : "—";
  const email = data && (data as any).ok ? ((data as any).customer_email as string | null) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="space-y-4">
        <p className="text-xs font-semibold text-slate-600">Contribution</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Merci pour votre soutien ❤️
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
          Votre contribution aide DogShift à accélérer son lancement. Un reçu Stripe a été envoyé à votre adresse e-mail.
        </p>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {state === "loading" ? (
          <p className="text-sm text-slate-600">Chargement des informations de paiement…</p>
        ) : null}

        {state === "error" ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">Impossible de retrouver votre paiement.</p>
            <p className="text-sm text-slate-600">Si le problème persiste, contactez-nous avec la référence ci-dessous.</p>
            <p className="text-xs text-slate-500">Référence : {sessionId || "—"}</p>
          </div>
        ) : null}

        {state === "success" && data && (data as any).ok ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate-600">Montant</p>
                <p className="text-sm font-semibold text-slate-900">{amountLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Statut</p>
                <p className="text-sm font-semibold text-slate-900">
                  {paymentStatus === "paid" ? "Payé" : paymentStatus === "unpaid" ? "Non payé" : "En attente / non confirmé"}
                </p>
              </div>
            </div>

            {email ? (
              <div>
                <p className="text-xs font-semibold text-slate-600">E-mail</p>
                <p className="text-sm text-slate-700">{email}</p>
              </div>
            ) : null}

            <p className="text-xs text-slate-500">Référence : {sessionId}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        >
          Retour à l’accueil
        </Link>
        <Link
          href="/#contribution"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        >
          Contribuer à nouveau
        </Link>
      </div>
    </main>
  );
}
