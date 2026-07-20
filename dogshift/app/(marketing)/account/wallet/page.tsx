/* eslint-disable */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { ArrowDownRight, ArrowUpRight, Briefcase, CreditCard, Info, RefreshCw, Wallet, CalendarClock, PlayCircle, ShieldCheck, CheckCircle2, Clock, Landmark, RotateCw, ChevronDown } from "lucide-react";
import { useIsNativeAppSync } from "@/lib/native/useIsNativeAppSync";


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
  service: string;
  url: string;
};

type WalletRefund = {
  bookingId: string;
  dateIso: string;
  amount: number;
  currency: string;
  status: "succeeded" | "failed";
  stripeRefundId: string;
  service: string;
  url: string;
};

type WalletHistoryItem =
  | ({ type: "payment" } & WalletPayment)
  | ({ type: "refund" } & WalletRefund);

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

/* ─── Animated counter with spring-like easing ─── */
function AnimatedCounter({ value, duration = 1400 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const diff = value - from;
    if (diff === 0) { setDisplay(value); return; }
    const t0 = performance.now();
    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setDisplay(from + diff * ease);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = value;
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <>{formatChfCents(Math.round(display))}</>;
}

/* ─── Clean donut ring (Multi-color by service) ─── */
function ExpenseRing({ data, total, trigger }: { data: { label: string; value: number }[]; total: number; trigger: number }) {
  const size = 200;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const refs = useRef<(SVGCircleElement | null)[]>([]);

  const SERVICE_COLORS: Record<string, string> = {
    "Promenade": "#0ea5e9", // sky-500
    "Garde": "#8b5cf6",     // violet-500
    "Pension": "#10b981",   // emerald-500
  };

  const validData = data.filter((d) => d.value > 0);

  useEffect(() => {
    if (trigger === 0) return;
    const t = setTimeout(() => {
      validData.forEach((d, i) => {
        const el = refs.current[i];
        if (!el) return;
        el.getAnimations().forEach((a) => a.cancel());
        const segLength = total > 0 ? (d.value / total) * c : 0;
        
        el.style.strokeDashoffset = String(c);
        el.animate(
          [{ strokeDashoffset: c }, { strokeDashoffset: c - segLength }],
          { duration: 1800, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }
        );
      });
    }, 100);
    return () => clearTimeout(t);
  }, [trigger, validData, total, c]);

  let currentAngle = -90;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg transition-all duration-500">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} className="transition-colors duration-300" />
      {validData.length === 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--dogshift-blue)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : (
        validData.map((d, i) => {
          const angle = currentAngle;
          currentAngle += (d.value / total) * 360;
          
          return (
            <circle
              key={d.label}
              ref={(el) => { refs.current[i] = el; }}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={SERVICE_COLORS[d.label] || "var(--dogshift-blue)"}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={c}
              transform={`rotate(${angle} ${size / 2} ${size / 2})`}
            />
          );
        })
      )}
    </svg>
  );
}

/* ─── Vertical bar chart ─── */
const SERVICE_COLORS: Record<string, string> = {
  "Promenade": "#0ea5e9", // sky-500
  "Garde": "#8b5cf6",     // violet-500
  "Pension": "#10b981",   // emerald-500
};

function VerticalBarChart({
  data,
  trigger,
}: {
  data: { label: string; count: number }[];
  trigger: number;
}) {
  const steps = 6;
  const step = 5;
  const yMax = 30;
  const chartHeight = 200;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const t = setTimeout(() => {
      data.forEach((d, i) => {
        const el = barRefs.current[i];
        if (!el) return;
        el.getAnimations().forEach((a) => a.cancel());
        const clamped = Math.min(d.count, yMax);
        const targetH = d.count > 0 ? Math.max((clamped / yMax) * chartHeight, 6) : 0;
        el.style.height = "0px";
        if (targetH > 0) {
          el.animate(
            [{ height: "0px" }, { height: `${targetH}px` }],
            { duration: 1200, easing: "cubic-bezier(.22,1,.36,1)", delay: i * 150, fill: "forwards" },
          );
        }
      });
    }, 100);
    return () => clearTimeout(t);
  }, [trigger, data, yMax, chartHeight]);

  return (
    <div className="flex w-full flex-col">
      <div className="relative flex gap-2">
        {/* Y-axis */}
        <div className="flex flex-col justify-between pr-2" style={{ height: chartHeight }}>
          {Array.from({ length: steps + 1 })
            .map((_, i) => (steps - i) * step)
            .map((val) => (
              <span key={val} className="text-[10px] tabular-nums text-slate-400 leading-none">
                {val}
              </span>
            ))}
        </div>

        {/* Grid + Bars */}
        <div className="relative flex-1">
          {/* Grid lines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: chartHeight }}>
            {Array.from({ length: steps + 1 }).map((_, i) => (
              <div key={i} className="h-px w-full bg-slate-100" />
            ))}
          </div>

          {/* Bars */}
          <div className="relative z-10 flex items-end" style={{ height: chartHeight }}>
            {data.map((d, i) => {
              const isHovered = hoveredIdx === i;
              const shade = SERVICE_COLORS[d.label] || "#cbd5e1";

              return (
                <div
                  key={d.label}
                  className="relative flex flex-1 flex-col items-center justify-end"
                  style={{ height: chartHeight }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Bar */}
                  <div
                    ref={(el) => { barRefs.current[i] = el; }}
                    className="relative w-8 cursor-pointer rounded-t-lg sm:w-10 md:w-12 flex justify-center"
                    style={{
                      height: 0,
                      background: d.count > 0 ? shade : "#e2e8f0",
                      minHeight: d.count === 0 ? 4 : 0,
                      transform: isHovered ? "scaleY(1.06)" : "scaleY(1)",
                      transformOrigin: "bottom",
                      boxShadow: isHovered && d.count > 0 ? `0 -8px 24px ${shade}40` : "none",
                      filter: hoveredIdx !== null && !isHovered ? "opacity(0.45)" : "opacity(1)",
                      transition: "transform 0.3s, box-shadow 0.3s, filter 0.3s",
                    }}
                  >
                    {/* Tooltip (Nombre exact) */}
                    <div 
                      className={`absolute -top-8 flex flex-col items-center transition-all duration-300 ${isHovered && d.count > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
                      style={{ transform: isHovered ? 'scaleY(0.94)' : 'scaleY(1)', transformOrigin: 'bottom' }}
                    >
                      <span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-bold text-white shadow-md">
                        {d.count}
                      </span>
                      <div className="h-1 w-2 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-slate-800" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Labels */}
          <div className="mt-2 flex">
            {data.map((d, i) => (
              <div key={d.label} className="flex flex-1 justify-center">
                <p
                  className={`truncate text-center text-[11px] font-medium transition-colors duration-300`}
                  style={{ color: hoveredIdx === i ? (SERVICE_COLORS[d.label] || "#0f172a") : "#64748b" }}
                >
                  {d.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}



// In-session cache so re-opening "Portefeuille" paints instantly, then
// revalidates silently. Cleared on a full reload.
let cachedWallet: WalletPayload | null = null;

function OwnerWalletContent() {
  const { status: __sessionStatus } = useSession();
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";

  const isNative = useIsNativeAppSync();
  const [walletFlipped, setWalletFlipped] = useState(false);
  const [loading, setLoading] = useState(() => cachedWallet === null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WalletPayload | null>(() => cachedWallet);
  const [timeframe, setTimeframe] = useState<"TODAY" | "WEEK" | "MONTH" | "ALL">("MONTH");
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    // Cached already rendered → refresh silently (no skeleton).
    const silent = cachedWallet !== null;
    async function load() {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/account/wallet", { method: "GET" });
        const payload = (await res.json()) as WalletPayload;
        if (cancelled) return;
        if (!res.ok || !payload.ok) {
          if (!silent) {
            setError("Impossible de charger le portefeuille.");
            setData(null);
          }
          return;
        }
        cachedWallet = payload;
        setData(payload);
      } catch {
        if (cancelled) return;
        if (!silent) {
          setError("Impossible de charger le portefeuille.");
          setData(null);
        }
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const history = useMemo(() => (Array.isArray(data?.history) ? data!.history! : []), [data]);

  // Filtrer l'historique par timeframe
  const filteredHistory = useMemo(() => {
    const now = Date.now();
    let limitTime = 0;
    if (timeframe === "TODAY") limitTime = now - 24 * 60 * 60 * 1000;
    else if (timeframe === "WEEK") limitTime = now - 7 * 24 * 60 * 60 * 1000;
    else if (timeframe === "MONTH") limitTime = now - 30 * 24 * 60 * 60 * 1000;

    return history.filter((item) => {
      if (limitTime === 0) return true;
      return new Date(item.dateIso).getTime() >= limitTime;
    });
  }, [history, timeframe]);

  // Calcul des totaux pour le timeframe
  const { totalPaid, totalRefunded, netBalance } = useMemo(() => {
    let paid = 0;
    let refunded = 0;
    for (const item of filteredHistory) {
      if (item.type === "payment") paid += item.amount;
      if (item.type === "refund" && item.status === "succeeded") refunded += item.amount;
    }
    return { totalPaid: paid, totalRefunded: refunded, netBalance: paid - refunded };
  }, [filteredHistory]);

  const ALL_SERVICES = ["Promenade", "Garde", "Pension"] as const;

  const serviceBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const svc of ALL_SERVICES) map[svc] = 0;
    for (const item of filteredHistory) {
      if (item.type === "payment") {
        const name = item.service?.trim() || "Autre";
        if (ALL_SERVICES.includes(name as any)) {
          map[name] = (map[name] ?? 0) + 1;
        } else if (name === "Dogsitting") {
          map["Garde"] = (map["Garde"] ?? 0) + 1;
        }
      }
    }
    return ALL_SERVICES.map((label) => ({ label, count: map[label] }));
  }, [filteredHistory]);

  const expensesByService = useMemo(() => {
    const map: Record<string, number> = {};
    for (const svc of ALL_SERVICES) map[svc] = 0;
    for (const item of filteredHistory) {
      if (item.type === "payment") {
        const name = item.service?.trim() || "Autre";
        if (ALL_SERVICES.includes(name as any)) {
          map[name] = (map[name] ?? 0) + (item.amount ?? 0);
        } else if (name === "Dogsitting") {
          map["Garde"] = (map["Garde"] ?? 0) + (item.amount ?? 0);
        }
      }
    }
    return ALL_SERVICES.map((label) => ({ label, value: map[label] }));
  }, [filteredHistory]);

  const [topTrigger, setTopTrigger] = useState(0);
  const hasTopTriggered = useRef(false);

  const fireTop = useCallback(() => {
    if (loading) return;
    setTopTrigger((k) => k + 1);
  }, [loading]);

  const onTopEnter = useCallback(() => {
    if (loading || hasTopTriggered.current) return;
    hasTopTriggered.current = true;
    fireTop();
  }, [loading, fireTop]);

  useEffect(() => {
    if (loading) {
      setTopTrigger(0);
      hasTopTriggered.current = false;
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    if (!hasTopTriggered.current) return;
    fireTop();
  }, [timeframe, loading, fireTop]);

  if (!isLoaded || !isSignedIn) return null;

  // ── Native app: compact wallet mirroring the sitter dashboard (flip card:
  //    expense ring ⇄ recent transactions), instead of the long web layout. ──
  if (isNative) {
    if (loading) {
      return (
        <div className="flex min-h-[55vh] items-center justify-center" data-testid="owner-wallet-page">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
        </div>
      );
    }
    const last3 = filteredHistory.slice(0, 3);
    return (
      <div className="flex flex-col pb-2" data-testid="owner-wallet-page">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Wallet className="h-6 w-6 text-[#7c3aed]" aria-hidden="true" />
            <span>Portefeuille</span>
          </h1>
          <button
            type="button"
            onClick={() => setWalletFlipped((v) => !v)}
            aria-label="Retourner la carte"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7c3aed]/10 text-[#7c3aed] active:scale-95"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="relative mt-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none"
          >
            <option value="TODAY">Aujourd&apos;hui</option>
            <option value="WEEK">7 derniers jours</option>
            <option value="MONTH">Mois en cours</option>
            <option value="ALL">Toujours</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7c3aed]" aria-hidden="true" />
        </div>

        {/* Flip card: expense ring (front) ⇄ recent transactions (back) */}
        <div className="mt-3 [perspective:1200px]">
          <div
            className={
              "relative h-[248px] w-full [transform-style:preserve-3d] transition-transform duration-500 " +
              (walletFlipped ? "[transform:rotateY(180deg)]" : "")
            }
          >
            {/* FRONT — expense ring */}
            <div className="absolute inset-0 flex items-center justify-center [backface-visibility:hidden]">
              <div className="relative">
                <ExpenseRing data={expensesByService} total={totalPaid} trigger={1} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Dépenses</p>
                  <p className="text-2xl font-extrabold text-slate-900">{formatChfCents(totalPaid)}</p>
                  <p className="text-xs text-slate-500">
                    {filteredHistory.length} service{filteredHistory.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* BACK — 3 dernières transactions */}
            <div className="absolute inset-0 flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <p className="text-sm font-semibold text-slate-900">Dernières transactions</p>
              <div className="mt-2 space-y-2">
                {last3.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucune transaction pour l&apos;instant.</p>
                ) : (
                  last3.map((item, i) => {
                    const isPayment = item.type === "payment";
                    return (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {isPayment ? "Paiement" : "Remboursement"}
                            {item.service ? ` · ${item.service}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">{formatDateShort(item.dateIso)}</p>
                        </div>
                        <span className={"shrink-0 text-sm font-semibold " + (isPayment ? "text-slate-900" : "text-rose-600")}>
                          {isPayment ? "" : "+"}
                          {formatChfCents(item.amount)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary — Total payé / Remboursé, right under the flip card
            (founder: the two cards were glued to the bottom, move them up). */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total payé</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900">{formatChfCents(totalPaid)}</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-500">Remboursé</p>
            <p className="mt-0.5 text-lg font-bold text-rose-900">{formatChfCents(totalRefunded)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid gap-6 overflow-x-hidden overflow-y-visible" data-testid="owner-wallet-page">
      <div className="relative z-10 grid gap-6">
        <div>
          <p className="text-sm font-semibold text-slate-600">Mon compte</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--dogshift-blue),white_80%)]">
              <Wallet className="h-5 w-5 text-[var(--dogshift-blue)]" aria-hidden="true" />
            </span>
            <span>Portefeuille</span>
          </h1>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-900 sm:p-8">
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="ds-card rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-sm font-semibold text-slate-900">Chargement…</p>
            <p className="mt-2 text-sm text-slate-600">Ton portefeuille est en cours de préparation.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ━━━ EXPENSE DASHBOARD ━━━ */}
            <div onMouseMove={onTopEnter} className="ds-card rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
              <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">Aperçu des statistiques</h2>
                  <p className="mt-1 text-sm text-slate-500">Dépenses et prestations sur la période sélectionnée.</p>
                </div>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-100 focus:border-[var(--dogshift-blue)] focus:bg-white focus:ring-2 focus:ring-[var(--dogshift-blue)]/20 sm:w-auto"
                >
                  <option value="TODAY">Aujourd'hui</option>
                  <option value="WEEK">7 derniers jours</option>
                  <option value="MONTH">Mois en cours</option>
                  <option value="ALL">Toujours</option>
                </select>
              </div>

              <div className="flex flex-col gap-10 lg:flex-row lg:items-stretch lg:gap-12">
                {/* Left: Ring + total */}
                <div className="flex flex-col items-center justify-center gap-5 lg:w-[240px] lg:shrink-0">
                  <div className="relative group cursor-pointer flex items-center justify-center">
                    <div className="relative z-10 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.04] group-hover:drop-shadow-[0_16px_32px_rgba(15,23,42,0.15)]">
                      <ExpenseRing data={expensesByService} total={totalPaid} trigger={topTrigger} />
                    </div>
                    
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.08]">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Dépenses</p>
                      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                        {topTrigger > 0 ? <AnimatedCounter value={totalPaid} /> : "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{filteredHistory.length} service{filteredHistory.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2 text-[11px] font-medium w-full">
                    {ALL_SERVICES.map((label) => {
                      const stat = expensesByService.find((r) => r.label === label);
                      const val = stat?.value || 0;
                      const COLORS: Record<string, { bg: string, text: string, ring: string, dot: string }> = {
                        "Promenade": { bg: "bg-sky-50", text: "text-sky-900", ring: "ring-sky-200", dot: "bg-sky-500" },
                        "Garde": { bg: "bg-violet-50", text: "text-violet-900", ring: "ring-violet-200", dot: "bg-violet-500" },
                        "Pension": { bg: "bg-emerald-50", text: "text-emerald-900", ring: "ring-emerald-200", dot: "bg-emerald-500" },
                      };
                      const colors = COLORS[label];
                      
                      return (
                        <span key={label} className={`inline-flex w-full cursor-pointer items-center justify-between gap-3 rounded-full ${colors.bg} px-3 py-1.5 ${colors.text} ring-1 ${colors.ring} transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.03] hover:shadow-sm hover:ring-2`}>
                          <span className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                            {label}
                          </span>
                          <span className="font-semibold">{formatChfCents(val)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Separator */}
                <div className="hidden w-px bg-slate-100 lg:block" />

                {/* Right: Vertical bar chart */}
                <div className="flex flex-1 flex-col">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900">Services réservés</h2>
                  <p className="mt-1 text-sm text-slate-500">Nombre de prestations par type de service.</p>

                  <div className="mt-4 flex min-h-[240px] flex-1 pb-4">
                    <VerticalBarChart data={serviceBreakdown} trigger={topTrigger} />
                  </div>
                </div>
              </div>
            </div>

            {/* Totaux compacts sous les graphes */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition-all hover:border-[var(--dogshift-blue)] hover:shadow-md sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">Total payé</p>
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" />
                </div>
                <p className="mt-1.5 text-base font-black text-slate-900 sm:mt-3 sm:text-2xl">{formatChfCents(totalPaid)}</p>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3 shadow-sm transition-all hover:border-rose-200 hover:shadow-md sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500 sm:text-xs">Total remboursé</p>
                  <ArrowDownRight className="h-3.5 w-3.5 text-rose-500 sm:h-4 sm:w-4" />
                </div>
                <p className="mt-1.5 text-base font-black text-rose-900 sm:mt-3 sm:text-2xl">{formatChfCents(totalRefunded)}</p>
              </div>

              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)] bg-[color-mix(in_srgb,var(--dogshift-blue),transparent_95%)] p-3 shadow-sm transition-all hover:border-[var(--dogshift-blue)] hover:shadow-md sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--dogshift-blue)] sm:text-xs">Coût net</p>
                  <Wallet className="h-3.5 w-3.5 text-[var(--dogshift-blue)] sm:h-4 sm:w-4" />
                </div>
                <p className="mt-1.5 text-base font-black text-slate-900 sm:mt-3 sm:text-2xl">{formatChfCents(netBalance)}</p>
              </div>
            </div>

            {/* Historique des transactions */}
            <div className="ds-card rounded-3xl border border-slate-100 bg-white/60 p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-7">
              <h2 className="mb-6 text-lg font-bold text-slate-900">Historique des transactions</h2>
              
              {filteredHistory.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 border-dashed bg-slate-50 p-8 text-center">
                  <p className="text-sm font-semibold text-slate-900">Aucune transaction</p>
                  <p className="mt-1 text-sm text-slate-500">Aucune transaction ne correspond à ce filtre.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(showAllHistory ? filteredHistory : filteredHistory.slice(0, 3)).map((item, i) => {
                    const isPayment = item.type === "payment";
                    return (
                      <div key={`hist-${i}`} className="group relative flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-slate-200 hover:shadow-md">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ${isPayment ? "bg-slate-50 text-slate-600 ring-slate-200" : "bg-rose-50 text-rose-600 ring-rose-200"}`}>
                            {isPayment ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                              <p className="text-sm font-bold text-slate-900">{isPayment ? "Paiement" : "Remboursement"}</p>
                              <span className="hidden sm:inline text-slate-300">•</span>
                              <p className="text-[11px] font-semibold text-slate-500">{formatDateShort(item.dateIso)}</p>
                              <span className="hidden sm:inline text-slate-300">•</span>
                              <p className="text-[11px] font-medium text-slate-500">{item.service}</p>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                item.status === "succeeded" || item.status === "PAID" || item.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" : 
                                item.status === "failed" || item.status === "PAYMENT_FAILED" || item.status === "REFUND_FAILED" ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20" : 
                                "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/20"
                              }`}>
                                {item.status === "succeeded" || item.status === "PAID" || item.status === "CONFIRMED" ? (isPayment ? "Confirmé" : "Traité") : 
                                  item.status === "failed" || item.status === "PAYMENT_FAILED" || item.status === "REFUND_FAILED" ? "Échoué" : item.status}
                              </span>
                              
                              <Link
                                href={item.url}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 transition-colors hover:text-[var(--dogshift-blue)]"
                              >
                                Voir la réservation
                                <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        </div>
                        <p className={`shrink-0 text-right text-base font-black tracking-tight ${isPayment ? "text-slate-900" : "text-rose-600"}`}>
                          {isPayment ? "" : "+"}{formatChfCents(item.amount)}
                        </p>
                      </div>
                    );
                  })}
                  
                  {filteredHistory.length > 3 && !showAllHistory && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowAllHistory(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                      >
                        Voir plus
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OwnerWalletPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--dogshift-blue)]"></div></div>}>
      <OwnerWalletContent />
    </Suspense>
  );
}
