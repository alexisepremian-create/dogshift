"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Wallet, CheckCircle2, Clock, Landmark } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";

function formatCents(amount: number) {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(amount / 100);
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

  return <>{formatCents(Math.round(display))}</>;
}

/* ─── Clean donut ring (DogShift blue only) ─── */
function RevenueRing({ total, trigger }: { total: number; trigger: number }) {
  const size = 200;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (trigger === 0) return;
    const t = setTimeout(() => {
      const el = circleRef.current;
      if (!el) return;
      const target = total > 0 ? c : 0;
      el.getAnimations().forEach((a) => a.cancel());
      el.setAttribute("stroke-dashoffset", String(c));
      el.animate(
        [{ strokeDashoffset: c }, { strokeDashoffset: c - target }],
        { duration: 1800, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" },
      );
    }, 100);
    return () => clearTimeout(t);
  }, [trigger, total, c]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle
        ref={circleRef}
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
    </svg>
  );
}

/* ─── Vertical bar chart ─── */
const BAR_SHADES = [
  "#0f2e5b",
  "#1a56a8",
  "#1e6fd1",
  "#4da3f7",
  "#7cc4f9",
  "#a8d8fd",
];

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
          <div className="relative z-10 flex items-end justify-around" style={{ height: chartHeight }}>
            {data.map((d, i) => {
              const isHovered = hoveredIdx === i;
              const shade = BAR_SHADES[i % BAR_SHADES.length];

              return (
                <div
                  key={d.label}
                  className="relative flex flex-col items-center justify-end"
                  style={{ height: chartHeight }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Bar */}
                  <div
                    ref={(el) => { barRefs.current[i] = el; }}
                    className="w-8 cursor-pointer rounded-t-lg sm:w-10 md:w-12"
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
                  />
                </div>
              );
            })}
          </div>

          {/* Labels */}
          <div className="mt-2 flex justify-around">
            {data.map((d, i) => (
              <p
                key={d.label}
                className={`max-w-[70px] truncate text-center text-[11px] font-medium transition-colors duration-300 ${
                  hoveredIdx === i ? "text-slate-900" : "text-slate-500"
                }`}
              >
                {d.label}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const MAINT_PURPLE = "#7969F0";

function PaymentCard({
  booking: b,
  endDate,
  isProcessing,
  isPayoutReady,
  index,
  trigger,
}: {
  booking: any;
  endDate: Date;
  isProcessing: boolean;
  isPayoutReady: boolean;
  index: number;
  trigger: number;
}) {
  const lineRef = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trigger === 0) return;
    const t = setTimeout(() => {
      const line = lineRef.current;
      const s2 = step2Ref.current;
      const s3 = step3Ref.current;

      const targetWidth = isPayoutReady
        ? "calc(66.6% - 24px)"
        : isProcessing
          ? "calc(33.3% - 12px)"
          : "0%";

      if (line) {
        line.getAnimations().forEach((a) => a.cancel());
        line.style.width = "0%";
        line.animate([{ width: "0%" }, { width: targetWidth }], {
          duration: 1400,
          easing: "cubic-bezier(.22,1,.36,1)",
          delay: 200 + index * 250,
          fill: "forwards",
        });
      }

      if (s2 && (isProcessing || isPayoutReady)) {
        s2.style.transform = "scale(0)";
        s2.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], {
          duration: 400,
          easing: "cubic-bezier(.22,1,.36,1)",
          delay: 700 + index * 250,
          fill: "forwards",
        });
      }

      if (s3 && isPayoutReady) {
        s3.style.transform = "scale(0)";
        s3.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], {
          duration: 400,
          easing: "cubic-bezier(.22,1,.36,1)",
          delay: 1100 + index * 250,
          fill: "forwards",
        });
      }
    }, 100);
    return () => clearTimeout(t);
  }, [trigger, isProcessing, isPayoutReady, index]);

  return (
    <div className="group rounded-2xl border border-slate-100 bg-white p-4 transition-all duration-500 hover:border-slate-200 hover:shadow-[0_8px_30px_-16px_rgba(2,6,23,0.10)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {b.owner?.avatarUrl ? (
            <img src={b.owner.avatarUrl} alt={b.owner.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white shadow-sm" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-400 text-xs font-bold text-white shadow-sm">
              {b.owner?.name?.charAt(0) ?? "?"}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">{b.owner?.name ?? "Client"}</p>
            <p className="text-[11px] text-slate-500">{b.service ?? "Service"} • {endDate.toLocaleDateString("fr-CH")}</p>
          </div>
        </div>
        <p className="text-base font-bold tracking-tight text-slate-900">{formatCents(b.amount)}</p>
      </div>

      {/* Compact timeline */}
      <div className="relative mt-4 px-1">
        <div className="absolute left-[calc(16.7%+12px)] right-[calc(16.7%+12px)] top-[11px] h-[2px] bg-slate-200" />
        <div
          ref={lineRef}
          className="absolute left-[calc(16.7%+12px)] top-[11px] h-[2px]"
          style={{ width: "0%", background: `linear-gradient(90deg, var(--dogshift-blue), ${MAINT_PURPLE}, #10b981)` }}
        />

        <div className="relative flex items-start justify-between text-center">
          <div className="flex w-1/3 flex-col items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--dogshift-blue)] text-white shadow ring-2 ring-white">
              <CheckCircle2 className="h-3 w-3" />
            </div>
            <p className="text-[10px] font-medium text-slate-600">Effectué</p>
          </div>
          <div className="flex w-1/3 flex-col items-center gap-1.5">
            <div
              ref={step2Ref}
              className={`flex h-6 w-6 items-center justify-center rounded-full shadow ring-2 ring-white ${
                isProcessing
                  ? "text-white"
                  : isPayoutReady
                    ? "text-white"
                    : "bg-slate-100 text-slate-400"
              }`}
              style={isProcessing || isPayoutReady ? { background: MAINT_PURPLE } : undefined}
            >
              <Clock className="h-3 w-3" />
            </div>
            <p className="text-[10px] font-medium text-slate-600">Traitement</p>
          </div>
          <div className="flex w-1/3 flex-col items-center gap-1.5">
            <div
              ref={step3Ref}
              className={`flex h-6 w-6 items-center justify-center rounded-full shadow ring-2 ring-white ${
                isPayoutReady
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <Landmark className="h-3 w-3" />
            </div>
            <p className="text-[10px] font-medium text-slate-600">Virement</p>
          </div>
        </div>
      </div>
    </div>
  );
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

  const [stripeInfoOpen, setStripeInfoOpen] = useState(false);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"TODAY" | "WEEK" | "MONTH" | "ALL">("MONTH");

  async function fetchBookings() {
    try {
      const res = await fetch("/api/host/requests");
      const data = await res.json();
      if (data.ok && Array.isArray(data.bookings)) {
        setAllBookings(data.bookings);
      }
    } catch { /* ignore */ } finally {
      setBookingsLoading(false);
    }
  }

  // Tous les bookings terminés (pour le suivi des paiements en bas)
  const allCompleted = useMemo(() => {
    return allBookings
      .filter(
        (b) =>
          (b.status === "CONFIRMED" || b.status === "PAID") &&
          b.endDate &&
          new Date(b.endDate).getTime() < Date.now()
      )
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  }, [allBookings]);

  // Bookings filtrés par timeframe (pour le Dashboard)
  const filteredBookings = useMemo(() => {
    const now = Date.now();
    let limitTime = 0;
    if (timeframe === "TODAY") limitTime = now - 24 * 60 * 60 * 1000;
    else if (timeframe === "WEEK") limitTime = now - 7 * 24 * 60 * 60 * 1000;
    else if (timeframe === "MONTH") limitTime = now - 30 * 24 * 60 * 60 * 1000;

    return allCompleted.filter((b) => {
      if (limitTime === 0) return true;
      return new Date(b.endDate).getTime() >= limitTime;
    });
  }, [allCompleted, timeframe]);

  const totalRevenueCents = useMemo(
    () => filteredBookings.reduce((s, b) => s + (b.amount ?? 0), 0),
    [filteredBookings]
  );

  const ALL_SERVICES = ["Promenade", "Garde", "Pension"] as const;

  const serviceBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const svc of ALL_SERVICES) map[svc] = 0;
    for (const b of filteredBookings) {
      const name = b.service?.trim() || "Autre";
      map[name] = (map[name] ?? 0) + 1;
    }
    return ALL_SERVICES.map((label) => ({ label, count: map[label] }));
  }, [filteredBookings]);

  const last3 = useMemo(() => allCompleted.slice(0, 3), [allCompleted]);

  const [topTrigger, setTopTrigger] = useState(0);
  const [bottomTrigger, setBottomTrigger] = useState(0);
  const hasTopTriggered = useRef(false);
  const hasBottomTriggered = useRef(false);
  const revRef = useRef<HTMLDivElement | null>(null);

  const fireTop = useCallback(() => {
    if (bookingsLoading) return;
    setTopTrigger((k) => k + 1);
  }, [bookingsLoading]);

  const fireBottom = useCallback(() => {
    if (bookingsLoading) return;
    setBottomTrigger((k) => k + 1);
  }, [bookingsLoading]);

  useEffect(() => {
    if (bookingsLoading) {
      setTopTrigger(0);
      setBottomTrigger(0);
      hasTopTriggered.current = false;
      hasBottomTriggered.current = false;
    }
  }, [bookingsLoading]);

  const onTopEnter = useCallback(() => {
    if (bookingsLoading || hasTopTriggered.current) return;
    hasTopTriggered.current = true;
    fireTop();
  }, [bookingsLoading, fireTop]);

  const onBottomEnter = useCallback(() => {
    if (bookingsLoading || hasBottomTriggered.current) return;
    hasBottomTriggered.current = true;
    fireBottom();
  }, [bookingsLoading, fireBottom]);

  useEffect(() => {
    if (bookingsLoading) return;
    if (!hasTopTriggered.current) return;
    fireTop();
  }, [timeframe, bookingsLoading, fireTop]);

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
    void fetchBookings();
  }, []);

  useEffect(() => {
    if (!stripeInfoOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setStripeInfoOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stripeInfoOpen]);

  useEffect(() => {
    if (!stripeInfoOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [stripeInfoOpen]);

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
        setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de générer le lien d'onboarding Stripe." }));
        return;
      }
      window.location.href = linkPayload.url;
    } catch {
      setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de démarrer l'onboarding Stripe." }));
    }
  }

  async function continueStripeOnboarding() {
    try {
      setStripeConnect((s) => ({ ...s, loading: true, error: null }));
      const linkRes = await fetch("/api/host/stripe/connect/link", { method: "POST" });
      const linkPayload = (await linkRes.json().catch(() => null)) as any;
      if (!linkRes.ok || !linkPayload?.ok || typeof linkPayload?.url !== "string") {
        setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de générer le lien d'onboarding Stripe." }));
        return;
      }
      window.location.href = linkPayload.url;
    } catch {
      setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible de continuer l'onboarding Stripe." }));
    }
  }

  async function openStripeDashboard() {
    try {
      setStripeConnect((s) => ({ ...s, loading: true, error: null }));
      const res = await fetch("/api/host/stripe/connect/login-link", { method: "POST" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || typeof payload?.url !== "string") {
        setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible d'ouvrir le dashboard Stripe." }));
        return;
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
      setStripeConnect((s) => ({ ...s, loading: false, error: null }));
    } catch {
      setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible d'ouvrir le dashboard Stripe." }));
    }
  }

  return (
    <div className="relative grid gap-6 overflow-x-hidden" data-testid="host-wallet-page">
      <SunCornerGlow variant="sitterDashboard" />

      <div className="relative z-10 grid gap-6">
        {/* ─── Header ─── */}
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

        {/* ─── Stripe Card ─── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">Paiements Stripe</p>
                <button
                  type="button"
                  onClick={() => setStripeInfoOpen(true)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Informations sur les paiements Stripe"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
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
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">ACTIVÉ</span>
            ) : stripeConnect.status === "RESTRICTED" ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">ACTION REQUISE</span>
            ) : stripeConnect.status === "PENDING" ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">EN ATTENTE</span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">NON ACTIVÉ</span>
            )}
          </div>
          {stripeConnect.status !== "ENABLED" ? (
            <p className="mt-2 text-xs font-medium text-slate-500">Connectez Stripe pour commencer à recevoir des paiements.</p>
          ) : null}
          {stripeConnect.status === "ENABLED" && stripeConnect.balance && stripeConnect.balance.pendingCents > 0 ? (
            <div className="mt-4 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 flex-none text-slate-400" aria-hidden="true" />
              <p className="text-xs font-medium leading-relaxed text-slate-600">
                Les virements Stripe peuvent prendre quelques jours ouvrables avant d'être versés sur ton compte bancaire.
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            {!stripeConnect.stripeAccountId ? (
              <button type="button" disabled={stripeConnect.loading} onClick={() => void startStripeOnboarding()} className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60">
                Activer les paiements
              </button>
            ) : stripeConnect.status === "ENABLED" ? (
              <button type="button" disabled={stripeConnect.loading} onClick={() => void openStripeDashboard()} className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                Ouvrir Stripe
              </button>
            ) : (
              <button type="button" disabled={stripeConnect.loading} onClick={() => void continueStripeOnboarding()} className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60">
                Continuer la vérification
              </button>
            )}
          </div>
        </div>

        {/* ─── Info modal ─── */}
        {stripeInfoOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Comment fonctionnent les paiements sur DogShift" onMouseDown={(e) => { if (e.target === e.currentTarget) setStripeInfoOpen(false); }}>
            <div className="fixed inset-x-4 top-8 mx-auto flex max-w-[520px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_100px_-60px_rgba(2,6,23,0.45)] sm:static sm:inset-auto sm:bottom-auto sm:top-auto sm:max-h-none sm:w-full sm:max-w-xl sm:rounded-3xl" style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
              <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-4 pb-4 pt-5 sm:p-6">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900">Comment fonctionnent les paiements sur DogShift</p>
                  <p className="mt-2 text-sm text-slate-600">Voici les points essentiels pour comprendre Stripe, les virements, et la différence entre &quot;En attente&quot; et &quot;Disponible&quot;.</p>
                </div>
                <button type="button" onClick={() => setStripeInfoOpen(false)} className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">Fermer</button>
              </div>
              <div className="grid flex-1 gap-5 overflow-y-auto p-4 pr-3 pb-24 text-sm text-slate-700 sm:max-h-[75vh] sm:p-6 sm:pr-6 sm:pb-6" style={{ WebkitOverflowScrolling: "touch", paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
                <section className="grid gap-2"><p className="font-semibold text-slate-900">1. Pourquoi connecter Stripe ?</p><p>Stripe permet de recevoir automatiquement les paiements des propriétaires de chiens. DogShift utilise Stripe pour sécuriser les transactions et effectuer les virements vers votre compte bancaire.</p></section>
                <section className="grid gap-2"><p className="font-semibold text-slate-900">2. Comment activer les paiements ?</p><ul className="list-disc pl-5 text-slate-700"><li>Cliquez sur &quot;Ouvrir Stripe&quot;</li><li>Complétez les informations demandées</li><li>Ajoutez votre IBAN</li><li>Vérifiez votre identité si nécessaire</li></ul><p>Une fois activé, vous pouvez recevoir des paiements automatiquement.</p></section>
                <section className="grid gap-2"><p className="font-semibold text-slate-900">3. Solde en attente vs disponible</p><ul className="list-disc pl-5 text-slate-700"><li>&quot;En attente&quot; = paiements en cours de traitement</li><li>&quot;Disponible&quot; = montant prêt à être viré sur votre compte bancaire</li></ul></section>
                <section className="grid gap-2"><p className="font-semibold text-slate-900">4. Quand suis-je payé ?</p><p>Les paiements deviennent disponibles après la fin de la réservation. Stripe effectue ensuite le virement automatiquement.</p></section>
                <section className="grid gap-2"><p className="font-semibold text-slate-900">5. Où voir les détails ?</p><p>Directement dans votre tableau de bord Stripe via le bouton &quot;Ouvrir Stripe&quot;.</p></section>
                <section className="grid gap-2"><p className="font-semibold text-slate-900">Pendant la phase pilote : 0% de commission DogShift</p><p>DogShift ne prélève aucune commission pendant la phase pilote. Vous conservez 100% du montant des réservations (frais Stripe inclus).</p></section>
              </div>
            </div>
          </div>
        ) : null}

        {/* ━━━ REVENUE DASHBOARD ━━━ */}
        <div ref={revRef} onMouseEnter={onTopEnter} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
          <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Aperçu des statistiques</h2>
              <p className="mt-1 text-sm text-slate-500">Revenus et prestations sur la période sélectionnée.</p>
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
              <div className="relative">
                <RevenueRing total={totalRevenueCents} trigger={topTrigger} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Revenus</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                    {!bookingsLoading && topTrigger > 0 ? <AnimatedCounter value={totalRevenueCents} /> : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{filteredBookings.length} service{filteredBookings.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 text-[11px] font-medium">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dogshift-blue)]/8 px-2.5 py-1 text-[var(--dogshift-blue)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  Disponible {formatCents(stripeConnect.balance?.availableCents ?? 0)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  En attente {formatCents(stripeConnect.balance?.pendingCents ?? 0)}
                </span>
              </div>
            </div>

            {/* Separator */}
            <div className="hidden w-px bg-slate-100 lg:block" />

            {/* Right: Vertical bar chart */}
            <div className="flex flex-1 flex-col">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Services effectués</h2>
              <p className="mt-1 text-sm text-slate-500">Nombre de prestations par type de service.</p>

              {bookingsLoading ? (
                <div className="mt-6 flex flex-1 items-end justify-around gap-4 pb-6">
                  {[60, 40, 75].map((h, i) => (
                    <div key={i} className="w-12 animate-pulse rounded-t-lg bg-slate-100" style={{ height: `${h}%` }} />
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex min-h-[240px] flex-1 pb-4">
                  <VerticalBarChart data={serviceBreakdown} trigger={topTrigger} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pilot phase */}
        <div className="flex gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <p className="text-sm leading-relaxed text-slate-600">
            🎉 <span className="font-semibold text-slate-900">Phase pilote : 0% de commission DogShift</span>
            <br />
            Vous conservez 100% du montant des réservations (frais Stripe inclus).
          </p>
        </div>

        {/* ━━━ PAYMENT TRACKING (last 3) ━━━ */}
        <div className="flex gap-6" onMouseEnter={onBottomEnter}>
          <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8 lg:max-w-[50%]">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Suivi des paiements</h2>
            <p className="mt-1 text-sm text-slate-500">
              Vos 3 derniers services terminés.
            </p>

            {bookingsLoading ? (
              <div className="mt-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-50" />
                ))}
              </div>
            ) : last3.length > 0 ? (
              <div className="mt-5 flex flex-col gap-3">
                {last3.map((b, idx) => {
                  const endDate = new Date(b.endDate);
                  const diffDays = (Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24);
                  const isProcessing = diffDays >= 0 && diffDays < 3;
                  const isPayoutReady = diffDays >= 3;

                  return (
                    <PaymentCard
                      key={b.id}
                      booking={b}
                      endDate={endDate}
                      isProcessing={isProcessing}
                      isPayoutReady={isPayoutReady}
                      index={idx}
                      trigger={bottomTrigger}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 flex items-center justify-center rounded-2xl bg-slate-50 py-10">
                <p className="text-sm text-slate-500">Aucun service terminé pour le moment.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
