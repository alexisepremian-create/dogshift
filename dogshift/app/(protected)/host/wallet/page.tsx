"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Wallet, CheckCircle2, Clock, Landmark, ShieldCheck, PlayCircle, ArrowRightLeft, CalendarClock } from "lucide-react";

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

/* ─── Clean donut ring (Multi-color by service) ─── */
function RevenueRing({ data, total, trigger }: { data: { label: string; value: number }[]; total: number; trigger: number }) {
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
  const [showS2, setShowS2] = useState(false);
  const [showS3, setShowS3] = useState(false);

  useEffect(() => {
    if (trigger === 0) {
      setShowS2(false);
      setShowS3(false);
      return;
    }
    const t = setTimeout(() => {
      const line = lineRef.current;
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
    }, 100);

    const t2 = setTimeout(() => setShowS2(true), 100 + 700 + index * 250);
    const t3 = setTimeout(() => setShowS3(true), 100 + 1100 + index * 250);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [trigger, isProcessing, isPayoutReady, index]);

  const s2Active = showS2 && (isProcessing || isPayoutReady);
  const s3Active = showS3 && isPayoutReady;

  return (
    <div className="group rounded-2xl border border-slate-100 bg-white p-4 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.03] hover:border-[var(--dogshift-blue)] hover:shadow-[0_20px_50px_-12px_rgba(58,124,245,0.15)] cursor-pointer">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {b.owner?.avatarUrl ? (
            <img src={b.owner.avatarUrl} alt={b.owner.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white shadow-sm transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-110 group-hover:shadow-md" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-400 text-xs font-bold text-white shadow-sm transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-110 group-hover:bg-[var(--dogshift-blue)] group-hover:shadow-md">
              {b.owner?.name?.charAt(0) ?? "?"}
            </div>
          )}
          <div className="transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-1">
            <p className="text-sm font-semibold text-slate-900 transition-colors duration-700 group-hover:text-[var(--dogshift-blue)]">{b.owner?.name ?? "Client"}</p>
            <p className="text-[11px] text-slate-500">{b.service ?? "Service"} • {endDate.toLocaleDateString("fr-CH")}</p>
          </div>
        </div>
        <p className="text-base font-bold tracking-tight text-slate-900 transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-x-1 group-hover:scale-105">{formatCents(b.amount)}</p>
      </div>

      {/* Compact timeline */}
      <div className="relative mt-4 px-1">
        <div className="absolute left-[calc(16.7%+12px)] right-[calc(16.7%+12px)] top-[11px] h-[2px] bg-slate-200" />
        <div
          ref={lineRef}
          className="absolute left-[calc(16.7%+12px)] top-[11px] h-[2px] bg-[var(--dogshift-blue)]"
          style={{ width: "0%" }}
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
              className={`flex h-6 w-6 items-center justify-center rounded-full shadow ring-2 ring-white transition-colors duration-500 ${
                s2Active
                  ? "bg-[var(--dogshift-blue)] text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <Clock className="h-3 w-3" />
            </div>
            <p className={`text-[10px] font-medium transition-colors duration-500 ${s2Active ? "text-slate-600" : "text-slate-400"}`}>Traitement</p>
          </div>
          <div className="flex w-1/3 flex-col items-center gap-1.5">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full shadow ring-2 ring-white transition-colors duration-500 ${
                s3Active
                  ? "bg-[var(--dogshift-blue)] text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              <Landmark className="h-3 w-3" />
            </div>
            <p className={`text-[10px] font-medium transition-colors duration-500 ${s3Active ? "text-slate-600" : "text-slate-400"}`}>Virement</p>
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
      if (ALL_SERVICES.includes(name as any)) {
        map[name] = (map[name] ?? 0) + 1;
      } else if (name === "Dogsitting") {
        map["Garde"] = (map["Garde"] ?? 0) + 1;
      }
    }
    return ALL_SERVICES.map((label) => ({ label, count: map[label] }));
  }, [filteredBookings]);

  const revenueByService = useMemo(() => {
    const map: Record<string, number> = {};
    for (const svc of ALL_SERVICES) map[svc] = 0;
    for (const b of filteredBookings) {
      const name = b.service?.trim() || "Autre";
      if (ALL_SERVICES.includes(name as any)) {
        map[name] = (map[name] ?? 0) + (b.amount ?? 0);
      } else if (name === "Dogsitting") {
        map["Garde"] = (map["Garde"] ?? 0) + (b.amount ?? 0);
      }
    }
    return ALL_SERVICES.map((label) => ({ label, value: map[label] }));
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
    // Auto-trigger for mobile/touch
    const t = setTimeout(() => {
      onTopEnter();
      onBottomEnter();
    }, 500);
    return () => clearTimeout(t);
  }, [bookingsLoading, onTopEnter, onBottomEnter]);

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
        alert("Impossible d'ouvrir le dashboard Stripe. Veuillez réessayer plus tard.");
        return;
      }
      window.location.href = payload.url;
    } catch {
      setStripeConnect((s) => ({ ...s, loading: false, error: "Impossible d'ouvrir le dashboard Stripe." }));
      alert("Impossible d'ouvrir le dashboard Stripe. Veuillez vérifier votre connexion.");
    }
  }

  return (
    <div className="relative grid gap-6" data-testid="host-wallet-page">
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

        {/* ─── Stripe Card was here ─── */}

        {/* ━━━ REVENUE DASHBOARD ━━━ */}
        <div ref={revRef} onMouseMove={onTopEnter} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
          <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Aperçu des statistiques</h2>
              <p className="mt-1 text-sm text-slate-500">Revenus et prestations sur la période sélectionnée.</p>
            </div>
            <div className="relative w-full sm:w-auto">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-100 focus:border-[var(--dogshift-blue)] focus:bg-white focus:ring-2 focus:ring-[var(--dogshift-blue)]/20 sm:w-auto"
              >
                <option value="TODAY">Aujourd'hui</option>
                <option value="WEEK">7 derniers jours</option>
                <option value="MONTH">Mois en cours</option>
                <option value="ALL">Toujours</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-10 lg:flex-row lg:items-stretch lg:gap-12">
            {/* Left: Ring + total */}
            <div className="flex flex-col items-center justify-center gap-5 lg:w-[240px] lg:shrink-0">
              <div className="relative group cursor-pointer flex items-center justify-center">
                <div className="relative z-10 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.04] group-hover:drop-shadow-[0_16px_32px_rgba(15,23,42,0.15)]">
                  <RevenueRing data={revenueByService} total={totalRevenueCents} trigger={topTrigger} />
                </div>
                
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.08]">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Revenus</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                    {!bookingsLoading && topTrigger > 0 ? <AnimatedCounter value={totalRevenueCents} /> : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{filteredBookings.length} service{filteredBookings.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 text-[11px] font-medium">
                {ALL_SERVICES.map((label) => {
                  const stat = revenueByService.find((r) => r.label === label);
                  const val = stat?.value || 0;
                  const SERVICE_COLORS: Record<string, { bg: string, text: string, ring: string, dot: string }> = {
                    "Promenade": { bg: "bg-sky-50", text: "text-sky-900", ring: "ring-sky-200", dot: "bg-sky-500" },
                    "Garde": { bg: "bg-violet-50", text: "text-violet-900", ring: "ring-violet-200", dot: "bg-violet-500" },
                    "Pension": { bg: "bg-emerald-50", text: "text-emerald-900", ring: "ring-emerald-200", dot: "bg-emerald-500" },
                  };
                  const colors = SERVICE_COLORS[label];
                  
                  return (
                    <span key={label} className={`inline-flex w-full cursor-pointer items-center justify-between gap-3 rounded-full ${colors.bg} px-3 py-1.5 ${colors.text} ring-1 ${colors.ring} transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.03] hover:shadow-sm hover:ring-2`}>
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                        {label}
                      </span>
                      <span className="font-semibold">{formatCents(val)}</span>
                    </span>
                  );
                })}
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


        {/* ━━━ PAYMENT TRACKING & STRIPE ━━━ */}
        <div className="flex flex-col lg:flex-row gap-6" onMouseMove={onBottomEnter} onTouchStart={onBottomEnter}>
          <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
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

          {/* Right side: Stripe & Pilot (FLIP CARD) */}

          {/* Mobile: no 3D flip (iOS Safari breaks backface-visibility with overflow ancestors) */}
          <div className="flex-1 lg:hidden">
            {!stripeInfoOpen ? (
              <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
                <div className="relative overflow-hidden p-6 sm:p-8">
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <button
                      type="button"
                      onClick={() => setStripeInfoOpen(true)}
                      className="group mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-50 shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:scale-110 hover:shadow-md hover:ring-slate-200"
                      aria-label="Comment fonctionnent les paiements Stripe"
                    >
                      <svg className="h-8 w-20 text-[#635BFF] transition-transform duration-500 group-hover:rotate-12" viewBox="54 36 360.02 149.84" fill="currentColor">
                        <path fillRule="evenodd" clipRule="evenodd" d="M414,113.4c0-25.6-12.4-45.8-36.1-45.8c-23.8,0-38.2,20.2-38.2,45.6c0,30.1,17,45.3,41.4,45.3 c11.9,0,20.9-2.7,27.7-6.5v-20c-6.8,3.4-14.6,5.5-24.5,5.5c-9.7,0-18.3-3.4-19.4-15.2h48.9C413.8,121,414,115.8,414,113.4z M364.6,103.9c0-11.3,6.9-16,13.2-16c6.1,0,12.6,4.7,12.6,16H364.6z" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M301.1,67.6c-9.8,0-16.1,4.6-19.6,7.8l-1.3-6.2h-22v116.6l25-5.3l0.1-28.3c3.6,2.6,8.9,6.3,17.7,6.3 c17.9,0,34.2-14.4,34.2-46.1C335.1,83.4,318.6,67.6,301.1,67.6z M295.1,136.5c-5.9,0-9.4-2.1-11.8-4.7l-0.1-37.1 c2.6-2.9,6.2-4.9,11.9-4.9c9.1,0,15.4,10.2,15.4,23.3C310.5,126.5,304.3,136.5,295.1,136.5z" />
                        <polygon fillRule="evenodd" clipRule="evenodd" points="223.8,61.7 248.9,56.3 248.9,36 223.8,41.3" />
                        <rect fillRule="evenodd" clipRule="evenodd" x="223.8" y="69.3" width="25.1" height="87.5" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M196.9,76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7,15.9-6.3,19-5.2v-23C214.5,68.1,202.8,65.9,196.9,76.7z" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M146.9,47.6l-24.4,5.2l-0.1,80.1c0,14.8,11.1,25.7,25.9,25.7c8.2,0,14.2-1.5,17.5-3.3V135 c-3.2,1.3-19,5.9-19-8.9V90.6h19V69.3h-19L146.9,47.6z" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M79.3,94.7c0-3.9,3.2-5.4,8.5-5.4c7.6,0,17.2,2.3,24.8,6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6 C67.5,67.6,54,78.2,54,95.9c0,27.6,38,23.2,38,35.1c0,4.6-4,6.1-9.6,6.1c-8.3,0-18.9-3.4-27.3-8v23.8c9.3,4,18.7,5.7,27.3,5.7 c20.8,0,35.1-10.3,35.1-28.2C117.4,100.6,79.3,105.9,79.3,94.7z" />
                      </svg>
                    </button>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold tracking-tight text-slate-900">Paiements Stripe</h3>
                      <button type="button" onClick={() => setStripeInfoOpen(true)} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Informations sur les paiements Stripe">
                        <Info className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="mt-2 max-w-[280px] text-sm text-slate-500">Connecte ton compte pour recevoir automatiquement les paiements sur ton compte bancaire.</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      {stripeConnect.status === "ENABLED" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-[13px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Activé</span>
                      ) : stripeConnect.status === "RESTRICTED" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-[13px] font-semibold text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Action requise</span>
                      ) : stripeConnect.status === "PENDING" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-[13px] font-semibold text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />En attente</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-[13px] font-semibold text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Non activé</span>
                      )}
                    </div>
                    {stripeConnect.status === "ENABLED" && stripeConnect.balance && stripeConnect.balance.pendingCents > 0 ? (
                      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left">
                        <p className="text-xs leading-relaxed text-slate-600"><Info className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" />Les virements peuvent prendre quelques jours ouvrables avant d&apos;arriver sur ton compte bancaire.</p>
                      </div>
                    ) : null}
                    <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                      {!stripeConnect.stripeAccountId ? (
                        <button type="button" disabled={stripeConnect.loading} onClick={() => void startStripeOnboarding()} className="inline-flex items-center justify-center rounded-2xl bg-[#635BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(99,91,255,0.4)] transition-all hover:-translate-y-0.5 hover:bg-[#524BDE] hover:shadow-[0_12px_24px_-8px_rgba(99,91,255,0.5)] disabled:pointer-events-none disabled:opacity-60">Activer les paiements</button>
                      ) : stripeConnect.status === "ENABLED" ? (
                        <button type="button" disabled={stripeConnect.loading} onClick={() => void openStripeDashboard()} className="inline-flex items-center justify-center rounded-2xl bg-[#635BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(99,91,255,0.4)] transition-all hover:-translate-y-0.5 hover:bg-[#524BDE] hover:shadow-[0_12px_24px_-8px_rgba(99,91,255,0.5)] disabled:pointer-events-none disabled:opacity-60">Ouvrir le Dashboard</button>
                      ) : (
                        <button type="button" disabled={stripeConnect.loading} onClick={() => void continueStripeOnboarding()} className="inline-flex items-center justify-center rounded-2xl bg-[#635BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(99,91,255,0.4)] transition-all hover:-translate-y-0.5 hover:bg-[#524BDE] hover:shadow-[0_12px_24px_-8px_rgba(99,91,255,0.5)] disabled:pointer-events-none disabled:opacity-60">Continuer l&apos;activation</button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-100 bg-slate-50/50 p-6 sm:px-8 rounded-b-3xl">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100"><span className="text-lg">🎉</span></div>
                    <div>
                      <p className="font-semibold text-slate-900">Phase pilote : 0% de commission</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">Vous conservez 100% du montant des réservations, frais Stripe inclus.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 sm:px-8 rounded-t-3xl">
                  <div>
                    <p className="font-semibold text-slate-900">Comment ça marche ?</p>
                    <p className="mt-1 text-[13px] text-slate-500">Paiements et virements via Stripe</p>
                  </div>
                  <button type="button" onClick={() => setStripeInfoOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-700">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-6 sm:px-8 text-[13px] leading-relaxed text-slate-600">
                  <div className="space-y-6">
                    <section className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-[#635BFF]" /><div><p className="font-semibold text-slate-900">Pourquoi Stripe ?</p><p className="mt-1.5">Stripe sécurise les transactions et automatise les virements vers votre compte bancaire. C&apos;est le standard mondial.</p></div></section>
                    <section className="flex gap-3"><PlayCircle className="h-5 w-5 shrink-0 text-[#635BFF]" /><div><p className="font-semibold text-slate-900">Comment l&apos;activer ?</p><p className="mt-1.5">Cliquez sur &quot;Activer les paiements&quot;, ajoutez votre IBAN et vérifiez votre identité. Une fois activé, tout est automatique.</p></div></section>
                    <section className="flex gap-3"><ArrowRightLeft className="h-5 w-5 shrink-0 text-[#635BFF]" /><div><p className="font-semibold text-slate-900">En attente vs Disponible</p><ul className="mt-1.5 list-disc pl-4 space-y-1"><li><span className="font-medium text-slate-700">En attente :</span> le paiement est sécurisé mais pas encore viré.</li><li><span className="font-medium text-slate-700">Disponible :</span> l&apos;argent va être envoyé sur votre compte.</li></ul></div></section>
                    <section className="flex gap-3"><CalendarClock className="h-5 w-5 shrink-0 text-[#635BFF]" /><div><p className="font-semibold text-slate-900">Quand suis-je payé ?</p><p className="mt-1.5">Les fonds deviennent disponibles après la fin de la réservation. Stripe effectue ensuite le virement (1 à 3 jours ouvrables).</p></div></section>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop: 3D flip card */}
          <div className="hidden lg:flex flex-1" style={{ perspective: "1500px" }}>
            <div
              className="relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{
                transformStyle: "preserve-3d",
                transform: stripeInfoOpen ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* FRONT FACE */}
              <div
                className={`absolute inset-0 flex flex-col justify-between rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] ${stripeInfoOpen ? 'pointer-events-none' : ''}`}
                style={{ backfaceVisibility: "hidden" }}
              >
                {/* Stripe Content */}
                <div className="relative overflow-hidden p-6 sm:p-8">
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <button
                      type="button"
                      onClick={() => setStripeInfoOpen(true)}
                      className="group mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-50 shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:scale-110 hover:shadow-md hover:ring-slate-200"
                      aria-label="Comment fonctionnent les paiements Stripe"
                    >
                      <svg className="h-8 w-20 text-[#635BFF] transition-transform duration-500 group-hover:rotate-12" viewBox="54 36 360.02 149.84" fill="currentColor">
                        <path fillRule="evenodd" clipRule="evenodd" d="M414,113.4c0-25.6-12.4-45.8-36.1-45.8c-23.8,0-38.2,20.2-38.2,45.6c0,30.1,17,45.3,41.4,45.3 c11.9,0,20.9-2.7,27.7-6.5v-20c-6.8,3.4-14.6,5.5-24.5,5.5c-9.7,0-18.3-3.4-19.4-15.2h48.9C413.8,121,414,115.8,414,113.4z M364.6,103.9c0-11.3,6.9-16,13.2-16c6.1,0,12.6,4.7,12.6,16H364.6z" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M301.1,67.6c-9.8,0-16.1,4.6-19.6,7.8l-1.3-6.2h-22v116.6l25-5.3l0.1-28.3c3.6,2.6,8.9,6.3,17.7,6.3 c17.9,0,34.2-14.4,34.2-46.1C335.1,83.4,318.6,67.6,301.1,67.6z M295.1,136.5c-5.9,0-9.4-2.1-11.8-4.7l-0.1-37.1 c2.6-2.9,6.2-4.9,11.9-4.9c9.1,0,15.4,10.2,15.4,23.3C310.5,126.5,304.3,136.5,295.1,136.5z" />
                        <polygon fillRule="evenodd" clipRule="evenodd" points="223.8,61.7 248.9,56.3 248.9,36 223.8,41.3" />
                        <rect fillRule="evenodd" clipRule="evenodd" x="223.8" y="69.3" width="25.1" height="87.5" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M196.9,76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7,15.9-6.3,19-5.2v-23C214.5,68.1,202.8,65.9,196.9,76.7z" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M146.9,47.6l-24.4,5.2l-0.1,80.1c0,14.8,11.1,25.7,25.9,25.7c8.2,0,14.2-1.5,17.5-3.3V135 c-3.2,1.3-19,5.9-19-8.9V90.6h19V69.3h-19L146.9,47.6z" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M79.3,94.7c0-3.9,3.2-5.4,8.5-5.4c7.6,0,17.2,2.3,24.8,6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6 C67.5,67.6,54,78.2,54,95.9c0,27.6,38,23.2,38,35.1c0,4.6-4,6.1-9.6,6.1c-8.3,0-18.9-3.4-27.3-8v23.8c9.3,4,18.7,5.7,27.3,5.7 c20.8,0,35.1-10.3,35.1-28.2C117.4,100.6,79.3,105.9,79.3,94.7z" />
                      </svg>
                    </button>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold tracking-tight text-slate-900">Paiements Stripe</h3>
                      <button
                        type="button"
                        onClick={() => setStripeInfoOpen(true)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Informations sur les paiements Stripe"
                      >
                        <Info className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="mt-2 max-w-[280px] text-sm text-slate-500">
                      Connecte ton compte pour recevoir automatiquement les paiements sur ton compte bancaire.
                    </p>

                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      {stripeConnect.status === "ENABLED" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-[13px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Activé
                        </span>
                      ) : stripeConnect.status === "RESTRICTED" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-[13px] font-semibold text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                          Action requise
                        </span>
                      ) : stripeConnect.status === "PENDING" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-[13px] font-semibold text-slate-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                          En attente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-[13px] font-semibold text-slate-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                          Non activé
                        </span>
                      )}
                    </div>

                    {stripeConnect.status === "ENABLED" && stripeConnect.balance && stripeConnect.balance.pendingCents > 0 ? (
                      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left">
                        <p className="text-xs leading-relaxed text-slate-600">
                          <Info className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom text-slate-400" />
                          Les virements peuvent prendre quelques jours ouvrables avant d'arriver sur ton compte bancaire.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                      {!stripeConnect.stripeAccountId ? (
                        <button type="button" disabled={stripeConnect.loading} onClick={() => void startStripeOnboarding()} className="inline-flex items-center justify-center rounded-2xl bg-[#635BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(99,91,255,0.4)] transition-all hover:-translate-y-0.5 hover:bg-[#524BDE] hover:shadow-[0_12px_24px_-8px_rgba(99,91,255,0.5)] disabled:pointer-events-none disabled:opacity-60">
                          Activer les paiements
                        </button>
                      ) : stripeConnect.status === "ENABLED" ? (
                        <button type="button" disabled={stripeConnect.loading} onClick={() => void openStripeDashboard()} className="inline-flex items-center justify-center rounded-2xl bg-[#635BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(99,91,255,0.4)] transition-all hover:-translate-y-0.5 hover:bg-[#524BDE] hover:shadow-[0_12px_24px_-8px_rgba(99,91,255,0.5)] disabled:pointer-events-none disabled:opacity-60">
                          Ouvrir le Dashboard
                        </button>
                      ) : (
                        <button type="button" disabled={stripeConnect.loading} onClick={() => void continueStripeOnboarding()} className="inline-flex items-center justify-center rounded-2xl bg-[#635BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(99,91,255,0.4)] transition-all hover:-translate-y-0.5 hover:bg-[#524BDE] hover:shadow-[0_12px_24px_-8px_rgba(99,91,255,0.5)] disabled:pointer-events-none disabled:opacity-60">
                          Continuer l'activation
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pilot Phase */}
                <div className="border-t border-slate-100 bg-slate-50/50 p-6 sm:px-8 rounded-b-3xl">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                      <span className="text-lg">🎉</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Phase pilote : 0% de commission</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">
                        Vous conservez 100% du montant des réservations, frais Stripe inclus.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* BACK FACE */}
              <div
                className={`absolute inset-0 flex flex-col rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] ${!stripeInfoOpen ? 'pointer-events-none' : ''}`}
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 sm:px-8 rounded-t-3xl">
                  <div>
                    <p className="font-semibold text-slate-900">Comment ça marche ?</p>
                    <p className="mt-1 text-[13px] text-slate-500">Paiements et virements via Stripe</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStripeInfoOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 sm:px-8 text-[13px] leading-relaxed text-slate-600">
                  <div className="space-y-6">
                    <section className="flex gap-3">
                      <ShieldCheck className="h-5 w-5 shrink-0 text-[#635BFF]" />
                      <div>
                        <p className="font-semibold text-slate-900">Pourquoi Stripe ?</p>
                        <p className="mt-1.5">Stripe sécurise les transactions et automatise les virements vers votre compte bancaire. C'est le standard mondial.</p>
                      </div>
                    </section>
                    <section className="flex gap-3">
                      <PlayCircle className="h-5 w-5 shrink-0 text-[#635BFF]" />
                      <div>
                        <p className="font-semibold text-slate-900">Comment l'activer ?</p>
                        <p className="mt-1.5">Cliquez sur "Activer les paiements", ajoutez votre IBAN et vérifiez votre identité. Une fois activé, tout est automatique.</p>
                      </div>
                    </section>
                    <section className="flex gap-3">
                      <ArrowRightLeft className="h-5 w-5 shrink-0 text-[#635BFF]" />
                      <div>
                        <p className="font-semibold text-slate-900">En attente vs Disponible</p>
                        <ul className="mt-1.5 list-disc pl-4 space-y-1">
                          <li><span className="font-medium text-slate-700">En attente :</span> le paiement est sécurisé mais pas encore viré.</li>
                          <li><span className="font-medium text-slate-700">Disponible :</span> l'argent va être envoyé sur votre compte.</li>
                        </ul>
                      </div>
                    </section>
                    <section className="flex gap-3">
                      <CalendarClock className="h-5 w-5 shrink-0 text-[#635BFF]" />
                      <div>
                        <p className="font-semibold text-slate-900">Quand suis-je payé ?</p>
                        <p className="mt-1.5">Les fonds deviennent disponibles après la fin de la réservation. Stripe effectue ensuite le virement (1 à 3 jours ouvrables).</p>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
