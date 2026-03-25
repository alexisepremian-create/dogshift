"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowDownRight, ArrowUpRight, Briefcase, CreditCard, Info, RefreshCw, Wallet } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";

type WalletSummary = {
  totalPaid: number;
  totalRefunded: number;
  netBalance: number;
};

type WalletPayment = {
  bookingId: string;
  dateIso: string;
  amount: number;
  currency: string;
  status: string;
  url: string;
};

type WalletRefund = {
  bookingId: string;
  dateIso: string;
  amount: number;
  currency: string;
  status: "succeeded" | "failed";
  stripeRefundId: string;
  url: string;
};

type WalletHistoryItem =
  | { type: "payment" } & WalletPayment
  | { type: "refund" } & WalletRefund;

type WalletPayload = {
  ok?: boolean;
  error?: string;
  summary?: WalletSummary;
  payments?: WalletPayment[];
  refunds?: WalletRefund[];
  history?: WalletHistoryItem[];
};

function formatChfCents(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(value / 100);
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CH", { day: "2-digit", month: "short" }).format(d);
}

function bookingStatusLabel(status: string) {
  switch (String(status ?? "")) {
    case "PAID":
      return { label: "Payée", tone: "emerald" as const };
    case "CONFIRMED":
      return { label: "Confirmée", tone: "emerald" as const };
    case "REFUNDED":
      return { label: "Remboursée", tone: "slate" as const };
    case "REFUND_FAILED":
      return { label: "Remboursement échoué", tone: "rose" as const };
    default:
      return { label: String(status ?? "—"), tone: "slate" as const };
  }
}

function Badge({ tone, children }: { tone: "emerald" | "slate" | "rose"; children: string }) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm";
  if (tone === "emerald") return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}>{children}</span>;
  if (tone === "rose") return <span className={`${base} border-rose-200 bg-rose-50 text-rose-800`}>{children}</span>;
  return <span className={`${base} border-slate-200 bg-slate-50 text-slate-700`}>{children}</span>;
}

/** Infobulle discrète : survol desktop (léger délai à la sortie), tap mobile, fermeture au clic extérieur. */
function WalletMetricHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setOpen(true);
  };

  const hideSoon = () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setOpen(false), 90);
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label="Informations sur cette donnée"
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </button>
      {open ? (
        <span
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hideSoon}
          className="absolute right-0 bottom-[calc(100%+4px)] z-30 w-[min(16.5rem,calc(100vw-2.5rem))] rounded-2xl border border-slate-200 bg-white p-3 text-left text-xs font-medium leading-snug text-slate-700 shadow-[0_12px_40px_-28px_rgba(2,6,23,0.35)]"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

export default function OwnerWalletPage() {
  const { isLoaded, isSignedIn } = useUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WalletPayload | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/account/wallet", { method: "GET" });
        const payload = (await res.json()) as WalletPayload;
        if (cancelled) return;
        if (!res.ok || !payload.ok) {
          setError("Impossible de charger le portefeuille.");
          setData(null);
          return;
        }
        setData(payload);
      } catch {
        if (cancelled) return;
        setError("Impossible de charger le portefeuille.");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const summary = data?.summary ?? { totalPaid: 0, totalRefunded: 0, netBalance: 0 };
  const history = useMemo(() => (Array.isArray(data?.history) ? data!.history! : []), [data]);

  if (!isLoaded || !isSignedIn) return null;

  const cardBase = "relative overflow-hidden rounded-3xl border p-5 shadow-sm";

  return (
    <div className="relative grid gap-6 overflow-x-hidden overflow-y-visible" data-testid="owner-wallet-page">
      <SunCornerGlow variant="ownerDashboard" />

      <div className="relative z-10 grid gap-6">
        <div>
          <p className="text-sm font-semibold text-slate-600">Mon compte</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            <Wallet className="h-6 w-6 text-slate-700" aria-hidden="true" />
            <span>Portefeuille</span>
          </h1>
          <div className="mt-3 flex min-h-[32px] items-center">
            <p className="text-sm text-slate-600">Synthèse de vos paiements, remboursements et historique.</p>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-900 sm:p-8">
            <p>{error}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-sm font-semibold text-slate-900">Chargement…</p>
            <p className="mt-2 text-sm text-slate-600">Nous récupérons ton portefeuille.</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="grid gap-4 sm:grid-cols-3 sm:items-stretch">
            <div className={`${cardBase} flex flex-col overflow-visible border-slate-200 bg-white`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                    <CreditCard className="h-4 w-4 text-slate-700" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold leading-snug text-slate-900">Total dépensé</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <WalletMetricHint text="Montant total que vous avez payé pour vos réservations sur DogShift." />
                  <ArrowUpRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{formatChfCents(summary.totalPaid)}</p>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">Montant total payé pour vos réservations</p>
            </div>

            <div className={`${cardBase} flex flex-col overflow-visible border-rose-200 bg-rose-50`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-white/80">
                    <RefreshCw className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold leading-snug text-slate-900">Total remboursé</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <WalletMetricHint text="Montant que vous avez récupéré suite à des annulations ou incidents." />
                  <ArrowDownRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-rose-800">{formatChfCents(summary.totalRefunded)}</p>
              <p className="mt-3 text-xs leading-relaxed text-slate-700">Montant remboursé suite aux annulations</p>
            </div>

            <div
              className={`${cardBase} flex flex-col overflow-visible border-2 border-[color-mix(in_srgb,var(--dogshift-blue),transparent_55%)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] shadow-[0_12px_40px_-28px_rgba(37,99,235,0.35)] sm:min-h-0`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--dogshift-blue),white_70%)] bg-white/80">
                    <Briefcase className="h-4 w-4 text-[rgb(37,99,235)]" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-slate-900">Coût net</p>
                </div>
                <WalletMetricHint text="Montant réellement dépensé (paiements moins remboursements)." />
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2rem] sm:leading-none">
                {formatChfCents(summary.netBalance)}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-700">Montant réellement dépensé</p>
            </div>
          </div>

        ) : null}

        {!loading && !error ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-sm font-semibold text-slate-800">Historique</p>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Aucune opération pour le moment.</p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {history.map((h) => {
                  const date = formatDateShort(h.dateIso);
                  const isRefund = h.type === "refund";
                  const label = isRefund ? "Remboursement" : "Paiement";
                  const signedAmount = isRefund ? -Math.abs(h.amount) : Math.abs(h.amount);
                  const amountLabel = formatChfCents(signedAmount);
                  const badge = (() => {
                    if (h.type === "refund") {
                      return h.status === "failed" ? { label: "Échoué", tone: "rose" as const } : { label: "Remboursé", tone: "slate" as const };
                    }
                    const s = bookingStatusLabel(h.status);
                    return { label: s.label, tone: s.tone };
                  })();
                  return (
                    <div key={`${h.type}:${h.bookingId}:${h.dateIso}`} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          <span className="mr-2 text-slate-500">[{date}]</span>
                          {label}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                          {h.url ? (
                            <Link href={h.url} className="text-xs font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                              Voir la réservation
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      <p className={isRefund ? "shrink-0 text-sm font-semibold text-rose-700" : "shrink-0 text-sm font-semibold text-slate-900"}>
                        {amountLabel}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
