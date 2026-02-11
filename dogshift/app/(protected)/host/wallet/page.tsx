"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Info, Wallet } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";

function formatCents(amount: number) {
  return `CHF ${(amount / 100).toFixed(2)}`;
}

export default function HostWalletPage() {
  const [stripeConnect, setStripeConnect] = useState<{
    loading: boolean;
    status: "PENDING" | "ENABLED" | "RESTRICTED" | null;
    stripeAccountId: string | null;
    onboardingCompletedAt: string | null;
    balance: { availableCents: number; pendingCents: number } | null;
    nextPayoutArrivalDate: string | null;
    error: string | null;
  }>({ loading: true, status: null, stripeAccountId: null, onboardingCompletedAt: null, balance: null, nextPayoutArrivalDate: null, error: null });

  async function refreshStripeStatus() {
    try {
      setStripeConnect((s) => ({ ...s, loading: true, error: null }));
      const res = await fetch("/api/host/stripe/connect/status", { method: "GET" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de charger le statut Stripe." }));
        return;
      }

      const st = typeof payload?.status === "string" ? payload.status : null;
      const accountId = typeof payload?.stripeAccountId === "string" ? payload.stripeAccountId : null;
      const onboardingCompletedAt = typeof payload?.stripeOnboardingCompletedAt === "string" ? payload.stripeOnboardingCompletedAt : null;
      const balance = payload?.balance && typeof payload.balance === "object" ? payload.balance : null;
      const nextPayoutArrivalDate = typeof payload?.nextPayoutArrivalDate === "string" ? payload.nextPayoutArrivalDate : null;

      setStripeConnect({
        loading: false,
        status: st === "PENDING" || st === "ENABLED" || st === "RESTRICTED" ? st : null,
        stripeAccountId: accountId,
        onboardingCompletedAt,
        balance,
        nextPayoutArrivalDate,
        error: null,
      });
    } catch {
      setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de charger le statut Stripe." }));
    }
  }

  useEffect(() => {
    void refreshStripeStatus();
  }, []);

  async function startStripeOnboarding() {
    try {
      setStripeConnect((s) => ({ ...s, loading: true, error: null }));
      const createRes = await fetch("/api/host/stripe/connect/create", { method: "POST" });
      const createPayload = (await createRes.json().catch(() => null)) as any;
      if (!createRes.ok || !createPayload?.ok) {
        setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de créer le compte Stripe." }));
        return;
      }

      const linkRes = await fetch("/api/host/stripe/connect/link", { method: "POST" });
      const linkPayload = (await linkRes.json().catch(() => null)) as any;
      if (!linkRes.ok || !linkPayload?.ok || typeof linkPayload?.url !== "string") {
        setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de générer le lien d’onboarding Stripe." }));
        return;
      }

      window.location.href = linkPayload.url;
    } catch {
      setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de démarrer l’onboarding Stripe." }));
    }
  }

  async function continueStripeOnboarding() {
    try {
      setStripeConnect((s) => ({ ...s, loading: true, error: null }));
      const linkRes = await fetch("/api/host/stripe/connect/link", { method: "POST" });
      const linkPayload = (await linkRes.json().catch(() => null)) as any;
      if (!linkRes.ok || !linkPayload?.ok || typeof linkPayload?.url !== "string") {
        setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de générer le lien d’onboarding Stripe." }));
        return;
      }
      window.location.href = linkPayload.url;
    } catch {
      setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de continuer l’onboarding Stripe." }));
    }
  }

  async function openStripeDashboard() {
    try {
      setStripeConnect((s) => ({ ...s, loading: true, error: null }));
      const res = await fetch("/api/host/stripe/connect/login-link", { method: "POST" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || typeof payload?.url !== "string") {
        setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible d’ouvrir le dashboard Stripe." }));
        return;
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
      setStripeConnect((s) => ({ ...s, loading: false, error: null }));
    } catch {
      setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible d’ouvrir le dashboard Stripe." }));
    }
  }

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="host-wallet-page">
      <SunCornerGlow variant="sitterDashboard" />

      <div className="relative z-10 grid gap-6">
        <div>
          <p className="text-sm font-semibold text-slate-600">Tableau de bord</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            <Wallet className="h-6 w-6 text-slate-700" aria-hidden="true" />
            <span>Portefeuille</span>
          </h1>
          <div className="mt-3 flex min-h-[32px] items-center">
            <p className="text-sm text-slate-600">Revenus, paiements, virements et historique.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Paiements Stripe</p>
              <p className="mt-2 text-sm text-slate-600">Connecte Stripe pour recevoir automatiquement les paiements.</p>
            </div>
            <button
              type="button"
              disabled={stripeConnect.loading}
              onClick={() => void refreshStripeStatus()}
              className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Rafraîchir
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {stripeConnect.status === "ENABLED" ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                ACTIVÉ
              </span>
            ) : stripeConnect.status === "RESTRICTED" ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                ACTION REQUISE
              </span>
            ) : stripeConnect.status === "PENDING" ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                EN ATTENTE
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                NON ACTIVÉ
              </span>
            )}
          </div>

          {stripeConnect.status === "ENABLED" && stripeConnect.balance && stripeConnect.balance.pendingCents > 0 ? (
            <div className="mt-4 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 flex-none text-slate-400" aria-hidden="true" />
              <p className="text-xs font-medium leading-relaxed text-slate-600">
                Les virements Stripe peuvent prendre quelques jours ouvrables avant d’être versés sur ton compte bancaire.
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            {!stripeConnect.stripeAccountId ? (
              <button
                type="button"
                disabled={stripeConnect.loading}
                onClick={() => void startStripeOnboarding()}
                className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Activer les paiements
              </button>
            ) : stripeConnect.status === "ENABLED" ? (
              <button
                type="button"
                disabled={stripeConnect.loading}
                onClick={() => void openStripeDashboard()}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Ouvrir Stripe
              </button>
            ) : (
              <button
                type="button"
                disabled={stripeConnect.loading}
                onClick={() => void continueStripeOnboarding()}
                className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continuer la vérification
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-sm font-semibold text-slate-800">Disponible</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {stripeConnect.status === "ENABLED" && stripeConnect.balance
                ? formatCents(stripeConnect.balance.availableCents)
                : "—"}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">Solde disponible</p>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50/40 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">En attente</p>
              <ArrowUpRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {stripeConnect.status === "ENABLED" && stripeConnect.balance
                ? formatCents(stripeConnect.balance.pendingCents)
                : "—"}
            </p>
            {stripeConnect.status === "ENABLED" && stripeConnect.balance && stripeConnect.balance.pendingCents > 0 && stripeConnect.nextPayoutArrivalDate ? (
              <p className="mt-2 text-xs font-medium text-slate-500">
                Prochain virement estimé: {new Date(stripeConnect.nextPayoutArrivalDate).toLocaleDateString("fr-CH")}
              </p>
            ) : (
              <p className="mt-2 text-xs font-medium text-slate-500">Solde en attente</p>
            )}
          </div>

          <div className="rounded-3xl border border-[color-mix(in_srgb,var(--dogshift-blue),white_65%)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Total gagné</p>
              <ArrowDownRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {stripeConnect.status === "ENABLED" && stripeConnect.balance
                ? formatCents(stripeConnect.balance.availableCents + stripeConnect.balance.pendingCents)
                : "—"}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">Disponible + en attente</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <p className="text-sm font-semibold text-slate-800">Historique</p>
          <p className="mt-2 text-sm text-slate-600">Bientôt, tu verras ici toutes tes opérations.</p>
          <div className="mt-4 h-10 w-full rounded-2xl bg-slate-50" />
        </div>
      </div>
    </div>
  );
}
