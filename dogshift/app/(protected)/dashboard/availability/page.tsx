"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useHostUser } from "@/components/HostUserProvider";
import { normalizeRanges } from "@/lib/availability/rangeValidation";
import type { HostProfileV1 } from "@/lib/hostProfile";

type ServiceTypeApi = "PROMENADE" | "DOGSITTING" | "PENSION";

type ServiceConfig = {
  enabled: boolean;
};

type ExceptionRow = {
  id: string;
  date: string; // yyyy-mm-dd
  startMin: number;
  endMin: number;
  status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
};

type AvailabilityRuleRow = {
  id: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  status: "AVAILABLE" | "ON_REQUEST";
};

type ToastState = { tone: "ok" | "error"; message: string } | null;

type PricingServiceKey = "Promenade" | "Garde" | "Pension";

const TARIFF_RANGES: Record<PricingServiceKey, { min: number; max: number }> = {
  Promenade: { min: 15, max: 25 },
  Garde: { min: 18, max: 30 },
  Pension: { min: 35, max: 60 },
};

function errorMessageFr(code: string) {
  if (code === "PRICING_REQUIRED") {
    return "Tarif requis\nTu dois d’abord définir un tarif pour ce service avant de pouvoir l’activer ou ajouter des disponibilités.\nTu peux le faire dans la section Services & tarifs.";
  }
  return code;
}

function statusLabelFr(value: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") {
  if (value === "AVAILABLE") return "Disponible";
  if (value === "ON_REQUEST") return "Sur demande";
  return "Indisponible";
}

function minutesToHHMM(min: number) {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function hhmmToMinutes(value: string) {
  const v = (value ?? "").trim();
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const out = hh * 60 + mm;
  if (out < 0 || out > 24 * 60) return null;
  return out;
}

function serviceMeta(svc: ServiceTypeApi) {
  if (svc === "PROMENADE") return { icon: "🚶", label: "Promenade" };
  if (svc === "DOGSITTING") return { icon: "🏠", label: "Dogsitting" };
  return { icon: "🛌", label: "Pension" };
}

function serviceDotTone(svc: ServiceTypeApi) {
  if (svc === "PROMENADE") return "bg-sky-400";
  if (svc === "DOGSITTING") return "bg-violet-400";
  return "bg-emerald-400";
}

function serviceRingTone(svc: ServiceTypeApi) {
  if (svc === "PROMENADE") return "ring-sky-200 bg-sky-50 text-sky-900";
  if (svc === "DOGSITTING") return "ring-violet-200 bg-violet-50 text-violet-900";
  return "ring-emerald-200 bg-emerald-50 text-emerald-900";
}

function serviceSolidTone(svc: ServiceTypeApi) {
  if (svc === "PROMENADE") return "bg-sky-500 text-white border-sky-500";
  if (svc === "DOGSITTING") return "bg-violet-500 text-white border-violet-500";
  return "bg-emerald-500 text-white border-emerald-500";
}

function pricingUnitLabel(svc: ServiceTypeApi) {
  return svc === "PENSION" ? "CHF / jour" : "CHF / heure";
}

function pricingRangeLabel(svc: ServiceTypeApi) {
  const key = pricingKeyForService(svc);
  const range = TARIFF_RANGES[key];
  return `${range.min}–${range.max} CHF`;
}

function statusCellTone(status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") {
  if (status === "AVAILABLE") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (status === "ON_REQUEST") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-slate-100 text-slate-500 ring-slate-200";
}

function serviceSupportsTimeSlots(svc: ServiceTypeApi) {
  return svc === "PROMENADE" || svc === "DOGSITTING";
}

function pricingKeyForService(svc: ServiceTypeApi): PricingServiceKey {
  if (svc === "PROMENADE") return "Promenade";
  if (svc === "DOGSITTING") return "Garde";
  return "Pension";
}

function parsePrice(raw: string) {
  const cleaned = raw.replace(",", ".").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function getTariffRangeError(service: PricingServiceKey, price: number) {
  const r = TARIFF_RANGES[service];
  if (!Number.isFinite(price)) return null;
  if (price < r.min || price > r.max) {
    return `Le prix doit être compris entre ${r.min} et ${r.max} CHF.`;
  }
  return null;
}

function dayStatusForService(
  row: {
    promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
    dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
    pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
  } | undefined,
  svc: ServiceTypeApi
) {
  if (!row) return "UNAVAILABLE" as const;
  if (svc === "PROMENADE") return row.promenadeStatus;
  if (svc === "DOGSITTING") return row.dogsittingStatus;
  return row.pensionStatus;
}

function startOfMonthIso(dt: Date) {
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 12, 0, 0, 0));
}

function toZurichIsoDate(dt: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function formatDateFrCh(isoDate: string) {
  const safe = (isoDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe;
  const dt = new Date(`${safe}T12:00:00Z`);
  const out = new Intl.DateTimeFormat("fr-CH", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
  return out.replaceAll(".", "-");
}

function monthMeta(cursor: Date) {
  const y = cursor.getUTCFullYear();
  const m = cursor.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1, 12, 0, 0, 0));
  const last = new Date(Date.UTC(y, m + 1, 0, 12, 0, 0, 0));
  const fromIso = toZurichIsoDate(first);
  const toIso = toZurichIsoDate(last);
  const firstLocalDow = new Date(`${fromIso}T12:00:00Z`).getUTCDay();
  const mondayIndex = (firstLocalDow + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", month: "long", year: "numeric" }).format(first);
  const daysInMonth = Number(toIso.slice(8, 10));
  return { fromIso, toIso, mondayIndex, daysInMonth, monthLabel, year: y, month: m };
}

export default function AvailabilityStudioPage() {
  const host = useHostUser();
  const sitterId = host.sitterId;
  const remoteProfile = (host.profile && typeof host.profile === "object" ? (host.profile as Partial<HostProfileV1>) : null);

  const [configByService, setConfigByService] = useState<Record<ServiceTypeApi, ServiceConfig | null>>({
    PROMENADE: null,
    DOGSITTING: null,
    PENSION: null,
  });
  const [pricingByService, setPricingByService] = useState<Record<ServiceTypeApi, number | undefined>>({
    PROMENADE: undefined,
    DOGSITTING: undefined,
    PENSION: undefined,
  });
  const [pricingInputByService, setPricingInputByService] = useState<Record<ServiceTypeApi, string>>({
    PROMENADE: "",
    DOGSITTING: "",
    PENSION: "",
  });
  const [pricingSavingByService, setPricingSavingByService] = useState<Record<ServiceTypeApi, boolean>>({
    PROMENADE: false,
    DOGSITTING: false,
    PENSION: false,
  });

  const [exceptionsByService, setExceptionsByService] = useState<Record<ServiceTypeApi, ExceptionRow[]>>({
    PROMENADE: [],
    DOGSITTING: [],
    PENSION: [],
  });

  const [rulesByService, setRulesByService] = useState<Record<ServiceTypeApi, AvailabilityRuleRow[]>>({
    PROMENADE: [],
    DOGSITTING: [],
    PENSION: [],
  });

  const [monthCursor, setMonthCursor] = useState(() => startOfMonthIso(new Date()));
  const meta = useMemo(() => monthMeta(monthCursor), [monthCursor]);

  const [monthDays, setMonthDays] = useState<
    Array<{ date: string; promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE" }>
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPing, setSavedPing] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);

  const [bookingInfoOpen, setBookingInfoOpen] = useState(false);
  const bookingInfoWrapRef = useRef<HTMLDivElement | null>(null);

  const [availabilityTab, setAvailabilityTab] = useState<ServiceTypeApi>("PROMENADE");

  const todayKeyZurich = useMemo(() => toZurichIsoDate(new Date()), []);

  const [exceptionDrawerOpen, setExceptionDrawerOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState<string>("");
  const [exceptionService, setExceptionService] = useState<ServiceTypeApi>("PROMENADE");
  const [exceptionStatus, setExceptionStatus] = useState<"AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE">("AVAILABLE");
  const [exceptionAllDay, setExceptionAllDay] = useState(true);
  const [exceptionRanges, setExceptionRanges] = useState<Array<{ startMin: number; endMin: number }>>([]);
  const [justAddedRangeIdx, setJustAddedRangeIdx] = useState<number | null>(null);
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [weeklySavingKey, setWeeklySavingKey] = useState<string | null>(null);
  const [quickActionSaving, setQuickActionSaving] = useState<string | null>(null);
  const [inlineExceptionOpen, setInlineExceptionOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const exceptionFormLoadedKeyRef = useRef<string>("");

  const exceptionDrawerTitleRef = useRef<HTMLParagraphElement | null>(null);
  const exceptionDrawerRef = useRef<HTMLDivElement | null>(null);
  const exceptionDrawerRestoreFocusRef = useRef<HTMLElement | null>(null);
  const exceptionDrawerInitialSnapshotRef = useRef<string>("");

  const monthStatusByDate = useMemo(() => {
    const map = new Map<string, (typeof monthDays)[number]>();
    for (const row of monthDays) map.set(row.date, row);
    return map;
  }, [monthDays]);

  const enabledServices = useMemo(() => {
    const services: ServiceTypeApi[] = ["PROMENADE", "DOGSITTING", "PENSION"];
    return services.filter((svc) => configByService[svc]?.enabled !== false);
  }, [configByService]);

  useEffect(() => {
    const pricing = remoteProfile?.pricing && typeof remoteProfile.pricing === "object" ? (remoteProfile.pricing as Partial<Record<PricingServiceKey, number>>) : {};
    const nextPricing: Record<ServiceTypeApi, number | undefined> = {
      PROMENADE: typeof pricing.Promenade === "number" ? pricing.Promenade : undefined,
      DOGSITTING: typeof pricing.Garde === "number" ? pricing.Garde : undefined,
      PENSION: typeof pricing.Pension === "number" ? pricing.Pension : undefined,
    };
    setPricingByService(nextPricing);
    setPricingInputByService({
      PROMENADE: nextPricing.PROMENADE !== undefined ? String(nextPricing.PROMENADE) : "",
      DOGSITTING: nextPricing.DOGSITTING !== undefined ? String(nextPricing.DOGSITTING) : "",
      PENSION: nextPricing.PENSION !== undefined ? String(nextPricing.PENSION) : "",
    });
  }, [remoteProfile]);

  const pricingErrorByService = useMemo(() => {
    return {
      PROMENADE:
        pricingByService.PROMENADE === undefined
          ? "Ajoute un prix pour activer ce service."
          : getTariffRangeError("Promenade", pricingByService.PROMENADE) ?? null,
      DOGSITTING:
        pricingByService.DOGSITTING === undefined
          ? "Ajoute un prix pour activer ce service."
          : getTariffRangeError("Garde", pricingByService.DOGSITTING) ?? null,
      PENSION:
        pricingByService.PENSION === undefined
          ? "Ajoute un prix pour activer ce service."
          : getTariffRangeError("Pension", pricingByService.PENSION) ?? null,
    } satisfies Record<ServiceTypeApi, string | null>;
  }, [pricingByService]);

  const canEditAvailabilityForTab = useMemo(() => {
    return (configByService[availabilityTab]?.enabled ?? true) && !pricingErrorByService[availabilityTab];
  }, [availabilityTab, configByService, pricingErrorByService]);

  useEffect(() => {
    if (!bookingInfoOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const root = bookingInfoWrapRef.current;
      const target = e.target as Node | null;
      if (!root || !target) return;
      if (!root.contains(target)) setBookingInfoOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, [bookingInfoOpen]);

  useEffect(() => {
    if (!enabledServices.length) return;
    if (!enabledServices.includes(availabilityTab)) setAvailabilityTab(enabledServices[0]);
  }, [availabilityTab, enabledServices]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("dashboard-availability-quick-actions-open");
      if (raw === "1") setQuickActionsOpen(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("dashboard-availability-quick-actions-open", quickActionsOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [quickActionsOpen]);

  useEffect(() => {
    if (!exceptionDrawerOpen) return;
    if (!enabledServices.length) return;
    if (!enabledServices.includes(exceptionService)) setExceptionService(enabledServices[0]);
  }, [enabledServices, exceptionDrawerOpen, exceptionService]);

  const refreshTokenRef = useRef(0);

  async function saveServiceEnabled(svc: ServiceTypeApi, enabled: boolean) {
    if (!sitterId) return;
    setLoading(true);
    setError(null);
    setTopError(null);
    try {
      setConfigByService((prev) => {
        const next = { ...prev };
        const cur = prev[svc];
        (next as any)[svc] = cur ? { ...cur, enabled } : ({ enabled } as any);
        return next;
      });

      const res = await fetch(`/api/sitters/me/service-config?service=${encodeURIComponent(svc)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "SAVE_ERROR");

      await refetchAll();
    } catch (e) {
      const code = e instanceof Error ? e.message : "SAVE_ERROR";
      if (code === "PRICING_REQUIRED") {
        setTopError(errorMessageFr(code));
        setError(null);
      }
      await refetchAll();
      if (code !== "PRICING_REQUIRED") setError(e instanceof Error ? e.message : "SAVE_ERROR");
    } finally {
      setLoading(false);
    }
  }

  async function saveServicePricing(svc: ServiceTypeApi) {
    if (!sitterId) return;
    const raw = pricingInputByService[svc] ?? "";
    const parsed = parsePrice(raw);
    const pricingKey = pricingKeyForService(svc);
    const nextAll: Record<PricingServiceKey, number | null> = {
      Promenade: pricingByService.PROMENADE ?? null,
      Garde: pricingByService.DOGSITTING ?? null,
      Pension: pricingByService.PENSION ?? null,
    };
    nextAll[pricingKey] = parsed;

    setPricingSavingByService((prev) => ({ ...prev, [svc]: true }));
    setError(null);
    setTopError(null);
    try {
      const res = await fetch("/api/host/profile/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing: nextAll }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; details?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error((typeof payload?.details === "string" && payload.details) || payload?.error || "SAVE_ERROR");
      }

      setPricingByService({
        PROMENADE: typeof nextAll.Promenade === "number" ? nextAll.Promenade : undefined,
        DOGSITTING: typeof nextAll.Garde === "number" ? nextAll.Garde : undefined,
        PENSION: typeof nextAll.Pension === "number" ? nextAll.Pension : undefined,
      });

      await refetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "SAVE_ERROR");
      await refetchAll();
    } finally {
      setPricingSavingByService((prev) => ({ ...prev, [svc]: false }));
    }
  }

  async function refetchAll() {
    if (!sitterId) return;
    const token = ++refreshTokenRef.current;
    setLoading(true);
    setError(null);

    try {
      const services: ServiceTypeApi[] = ["PROMENADE", "DOGSITTING", "PENSION"];

      const cfgPairs = await Promise.all(
        services.map(async (svc) => {
          const res = await fetch(`/api/sitters/me/service-config?service=${encodeURIComponent(svc)}`, { method: "GET", cache: "no-store" });
          const payload = (await res.json().catch(() => null)) as any;
          if (!res.ok || !payload?.ok || typeof payload?.enabled !== "boolean") throw new Error("CONFIG_ERROR");
          return [svc, { enabled: payload.enabled } satisfies ServiceConfig] as const;
        })
      );
      if (token !== refreshTokenRef.current) return;
      setConfigByService((prev) => {
        const next = { ...prev };
        for (const [svc, cfg] of cfgPairs) (next as any)[svc] = cfg;
        return next;
      });

      const excPairs = await Promise.all(
        services.map(async (svc) => {
          const res = await fetch(
            `/api/sitters/me/availability-exceptions?service=${encodeURIComponent(svc)}&from=${encodeURIComponent(meta.fromIso)}&to=${encodeURIComponent(meta.toIso)}`,
            { method: "GET", cache: "no-store" }
          );
          const payload = (await res.json().catch(() => null)) as any;
          if (!res.ok || !payload?.ok || !Array.isArray(payload?.exceptions)) throw new Error("EXC_ERROR");
          return [svc, payload.exceptions as ExceptionRow[]] as const;
        })
      );
      if (token !== refreshTokenRef.current) return;
      setExceptionsByService((prev) => {
        const next = { ...prev };
        for (const [svc, exceptions] of excPairs) (next as any)[svc] = exceptions;
        return next;
      });

      const rulePairs = await Promise.all(
        services.map(async (svc) => {
          const res = await fetch(`/api/sitters/me/availability-rules?service=${encodeURIComponent(svc)}`, { method: "GET", cache: "no-store" });
          const payload = (await res.json().catch(() => null)) as any;
          if (!res.ok) {
            if (payload?.error === "PRICING_REQUIRED") return [svc, [] as AvailabilityRuleRow[]] as const;
            throw new Error("RULES_ERROR");
          }
          if (!payload?.ok || !Array.isArray(payload?.rules)) throw new Error("RULES_ERROR");
          return [svc, payload.rules as AvailabilityRuleRow[]] as const;
        })
      );
      if (token !== refreshTokenRef.current) return;
      setRulesByService((prev) => {
        const next = { ...prev };
        for (const [svc, rules] of rulePairs) (next as any)[svc] = rules;
        return next;
      });

      // Public preview month calendar (truth = slotEngine summaries)
      const qp = new URLSearchParams();
      qp.set("from", meta.fromIso);
      qp.set("to", meta.toIso);
      const res = await fetch(`/api/sitters/${encodeURIComponent(sitterId)}/day-status/multi?${qp.toString()}`, { method: "GET", cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || !Array.isArray(payload?.days)) throw new Error("DAY_STATUS_ERROR");
      if (token !== refreshTokenRef.current) return;
      setMonthDays(payload.days);

      setSavedPing("Synchronisé avec l’agenda public");
      setTimeout(() => setSavedPing(null), 1800);
    } catch (e) {
      if (token !== refreshTokenRef.current) return;
      setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      if (token !== refreshTokenRef.current) return;
      setLoading(false);
    }

    return;
  }

  async function saveWeeklyRule(svc: ServiceTypeApi, dayOfWeek: number, enabled: boolean, status: "AVAILABLE" | "ON_REQUEST") {
    if (!sitterId) return;
    setLoading(true);
    setError(null);
    setTopError(null);
    setWeeklySavingKey(`${svc}-${dayOfWeek}`);
    setRulesByService((prev) => {
      const current = prev[svc] ?? [];
      const nextRules = current.filter((rule) => rule.dayOfWeek !== dayOfWeek);
      if (enabled) {
        nextRules.push({
          id: `optimistic-${svc}-${dayOfWeek}`,
          dayOfWeek,
          startMin: 0,
          endMin: 24 * 60,
          status,
        });
      }
      return { ...prev, [svc]: nextRules };
    });
    try {
      const res = await fetch(`/api/sitters/me/availability-rules?service=${encodeURIComponent(svc)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek,
          rules: enabled ? [{ startMin: 0, endMin: 24 * 60, status }] : [],
        }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "SAVE_ERROR");
      await refetchAll();
    } catch (e) {
      const code = e instanceof Error ? e.message : "SAVE_ERROR";
      if (code === "PRICING_REQUIRED") {
        setTopError(errorMessageFr(code));
        setError(null);
      } else {
        setError(code);
      }
      await refetchAll();
    } finally {
      setWeeklySavingKey(null);
      setLoading(false);
    }
  }

  const effectiveStatusForDate = useMemo(() => {
    const rulesMaps: Record<ServiceTypeApi, Map<number, "AVAILABLE" | "ON_REQUEST">> = {
      PROMENADE: new Map(),
      DOGSITTING: new Map(),
      PENSION: new Map(),
    };

    for (const svc of ["PROMENADE", "DOGSITTING", "PENSION"] as const) {
      for (const rule of rulesByService[svc] ?? []) {
        rulesMaps[svc].set(rule.dayOfWeek, rule.status);
      }
    }

    return (dateIso: string, svc: ServiceTypeApi) => {
      const exception = (exceptionsByService[svc] ?? []).find((row) => row.date === dateIso);
      if (exception) return exception.status;
      const dow = new Date(`${dateIso}T12:00:00Z`).getUTCDay();
      const weeklyStatus = rulesMaps[svc].get(dow);
      if (weeklyStatus) return weeklyStatus;
      return "UNAVAILABLE" as const;
    };
  }, [exceptionsByService, rulesByService]);

  const bookableDatesByService = useMemo(() => {
    const mk = (svc: ServiceTypeApi) => {
      const set = new Set<string>();
      for (const row of monthDays) {
        if (!row || typeof row.date !== "string") continue;
        const status = effectiveStatusForDate(row.date, svc);
        if (status === "AVAILABLE" || status === "ON_REQUEST") set.add(row.date);
      }
      return set;
    };
    return {
      PROMENADE: mk("PROMENADE"),
      DOGSITTING: mk("DOGSITTING"),
      PENSION: mk("PENSION"),
    };
  }, [effectiveStatusForDate, monthDays]);

  const weeklyDayOptions = useMemo(
    () => [
      { dayOfWeek: 1, label: "Lundi" },
      { dayOfWeek: 2, label: "Mardi" },
      { dayOfWeek: 3, label: "Mercredi" },
      { dayOfWeek: 4, label: "Jeudi" },
      { dayOfWeek: 5, label: "Vendredi" },
      { dayOfWeek: 6, label: "Samedi" },
      { dayOfWeek: 0, label: "Dimanche" },
    ],
    []
  );

  const weeklyRulesForTab = useMemo(() => {
    const map = new Map<number, { enabled: boolean; status: "AVAILABLE" | "ON_REQUEST" }>();
    for (const day of weeklyDayOptions) {
      map.set(day.dayOfWeek, { enabled: false, status: "AVAILABLE" });
    }
    for (const rule of rulesByService[availabilityTab] ?? []) {
      if (!map.has(rule.dayOfWeek)) continue;
      map.set(rule.dayOfWeek, { enabled: true, status: rule.status });
    }
    return map;
  }, [availabilityTab, rulesByService, weeklyDayOptions]);

  const exceptionsForSelectedDate = useMemo(() => {
    if (!exceptionDate) return [] as ExceptionRow[];
    return (exceptionsByService[exceptionService] ?? []).filter((e) => e.date === exceptionDate);
  }, [exceptionDate, exceptionService, exceptionsByService]);

  function openInlineException(dateIso: string) {
    const svc = availabilityTab;
    const existing = (exceptionsByService[svc] ?? []).filter((e) => e.date === dateIso).sort((a, b) => a.startMin - b.startMin);
    const fallbackStatus = effectiveStatusForDate(dateIso, svc);
    const isAllDay = existing.length === 1 && existing[0]?.startMin === 0 && existing[0]?.endMin === 24 * 60;
    setExceptionDate(dateIso);
    setExceptionService(svc);
    setExceptionStatus(existing[0]?.status ?? fallbackStatus);
    setExceptionAllDay(existing.length ? isAllDay : true);
    setExceptionRanges(
      existing.length && !isAllDay
        ? existing.map((row) => ({ startMin: row.startMin, endMin: row.endMin })).sort((a, b) => a.startMin - b.startMin)
        : []
    );
    setExceptionError(null);
    setInlineExceptionOpen(true);
  }

  function upsertLocalSingleDayException(
    serviceType: ServiceTypeApi,
    date: string,
    status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE",
    ranges: Array<{ startMin: number; endMin: number }>
  ) {
    setExceptionsByService((prev) => {
      const current = prev[serviceType] ?? [];
      const remaining = current.filter((row) => row.date !== date);
      const optimistic = ranges.map((range, idx) => ({
        id: `optimistic-${serviceType}-${date}-${idx}`,
        date,
        startMin: range.startMin,
        endMin: range.endMin,
        status,
      }));
      return {
        ...prev,
        [serviceType]: [...remaining, ...optimistic].sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.startMin - b.startMin;
        }),
      };
    });
  }

  async function saveSingleDayException(serviceType: ServiceTypeApi, date: string, status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") {
    setExceptionSaving(true);
    setExceptionError(null);
    setTopError(null);
    try {
      const supportsSlots = serviceSupportsTimeSlots(serviceType);
      const normalized =
        status === "UNAVAILABLE"
          ? { ok: true as const, ranges: [{ startMin: 0, endMin: 24 * 60 }] }
          : !supportsSlots || exceptionAllDay
            ? { ok: true as const, ranges: [{ startMin: 0, endMin: 24 * 60 }] }
            : normalizeRanges(exceptionRanges);
      if (!normalized.ok) {
        setExceptionError(normalized.error === "INVALID_RANGES" ? "Ajoute des horaires valides." : "Les plages se chevauchent.");
        return;
      }
      const ranges = normalized.ranges.length ? normalized.ranges : [{ startMin: 0, endMin: 24 * 60 }];
      upsertLocalSingleDayException(serviceType, date, status, ranges);
      setAvailabilityTab(serviceType);
      const res = await fetch("/api/sitters/me/availability-exceptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          date,
          status,
          ranges,
        }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "SAVE_ERROR");
      await refetchAll();
      setInlineExceptionOpen(false);
    } catch (e) {
      await refetchAll();
      const code = e instanceof Error ? e.message : "SAVE_ERROR";
      if (code === "PRICING_REQUIRED") {
        setTopError(errorMessageFr(code));
        setError(null);
      } else {
        setExceptionError(code);
      }
    } finally {
      setExceptionSaving(false);
    }
  }

  async function applyQuickAction(action: "all-available-week" | "all-available-month" | "copy-week") {
    if (!sitterId) return;
    setQuickActionSaving(action);
    setError(null);
    setTopError(null);
    try {
      const monthDates = Array.from({ length: meta.daysInMonth }, (_, i) => {
        const day = i + 1;
        return `${String(meta.year).padStart(4, "0")}-${String(meta.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      });
      const futureMonthDates = monthDates.filter((date) => date >= todayKeyZurich);
      if (!futureMonthDates.length) return;
      const statusByDate = new Map<string, "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE">();
      let dates = futureMonthDates;

      if (action === "all-available-week") {
        const ref = new Date(`${todayKeyZurich}T12:00:00Z`);
        const refDow = ref.getUTCDay();
        const sundayDelta = (7 - refDow) % 7;
        const weekEnd = new Date(ref);
        weekEnd.setUTCDate(ref.getUTCDate() + sundayDelta);
        const weekEndIso = toZurichIsoDate(weekEnd);
        dates = futureMonthDates.filter((date) => date <= weekEndIso);
        for (const date of dates) statusByDate.set(date, "AVAILABLE");
      } else if (action === "all-available-month") {
        for (const date of dates) statusByDate.set(date, "AVAILABLE");
      } else {
        const refDate = meta.fromIso <= todayKeyZurich && todayKeyZurich <= meta.toIso ? todayKeyZurich : futureMonthDates[0];
        const ref = new Date(`${refDate}T12:00:00Z`);
        const refDow = ref.getUTCDay();
        const mondayDelta = (refDow + 6) % 7;
        const weekStart = new Date(ref);
        weekStart.setUTCDate(ref.getUTCDate() - mondayDelta);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
        const weekEndIso = toZurichIsoDate(weekEnd);
        const template = new Map<number, "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE">();

        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setUTCDate(weekStart.getUTCDate() + i);
          const iso = toZurichIsoDate(d);
          if (iso < todayKeyZurich) continue;
          template.set(d.getUTCDay(), effectiveStatusForDate(iso, availabilityTab));
        }

        dates = futureMonthDates.filter((date) => date > weekEndIso);

        for (const date of dates) {
          const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
          const copied = template.get(dow);
          if (copied) {
            statusByDate.set(date, copied);
          } else {
            statusByDate.set(date, effectiveStatusForDate(date, availabilityTab));
          }
        }
      }

      if (!dates.length) return;

      await Promise.all(
        dates.map(async (date) => {
          const status = statusByDate.get(date) ?? "UNAVAILABLE";
          const res = await fetch("/api/sitters/me/availability-exceptions", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              serviceType: availabilityTab,
              date,
              status,
              ranges: status === "UNAVAILABLE" ? [] : [{ startMin: 0, endMin: 24 * 60 }],
            }),
          });
          const payload = (await res.json().catch(() => null)) as any;
          if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "SAVE_ERROR");
        })
      );

      await refetchAll();
    } catch (e) {
      const code = e instanceof Error ? e.message : "SAVE_ERROR";
      if (code === "PRICING_REQUIRED") {
        setTopError(errorMessageFr(code));
        setError(null);
      } else {
        setError(code);
      }
    } finally {
      setQuickActionSaving(null);
    }
  }

  async function resetCurrentMonth() {
    if (!sitterId) return;
    const confirmed = window.confirm("Réinitialiser ce mois ? Toutes les exceptions du mois affiché seront supprimées.");
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setTopError(null);
    try {
      const serviceDates = (["PROMENADE", "DOGSITTING", "PENSION"] as const).flatMap((svc) => {
        const dates = Array.from(new Set((exceptionsByService[svc] ?? []).map((row) => row.date).filter((date) => Boolean(date))));
        return dates.map((date) => ({ svc, date }));
      });

      await Promise.all(
        serviceDates.map(async ({ svc, date }) => {
          const res = await fetch("/api/sitters/me/availability-exceptions", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serviceType: svc, date }),
          });
          const payload = (await res.json().catch(() => null)) as any;
          if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "DELETE_ERROR");
        })
      );

      await refetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "DELETE_ERROR");
    } finally {
      setLoading(false);
    }
  }

  const exceptionRangesValidation = useMemo(() => {
    if (exceptionAllDay) return { ok: true as const, error: null as string | null };
    if (!exceptionRanges.length) return { ok: false as const, error: "Ajoute au moins une plage." };
    for (const r of exceptionRanges) {
      if (r.endMin <= r.startMin) return { ok: false as const, error: "Une plage a une fin avant son début." };
    }
    const normalized = normalizeRanges(exceptionRanges);
    if (!normalized.ok) return { ok: false as const, error: "Les plages se chevauchent." };
    return { ok: true as const, error: null as string | null };
  }, [exceptionAllDay, exceptionRanges]);

  const exceptionHasUnsavedChanges = useMemo(() => {
    if (!exceptionDrawerOpen) return false;
    const snap = JSON.stringify({
      date: exceptionDate,
      service: exceptionService,
      status: exceptionStatus,
      allDay: exceptionAllDay,
      ranges: exceptionRanges,
    });
    return snap !== exceptionDrawerInitialSnapshotRef.current;
  }, [exceptionAllDay, exceptionDate, exceptionDrawerOpen, exceptionRanges, exceptionService, exceptionStatus]);

  function closeExceptionDrawer() {
    if (exceptionSaving) return;
    if (exceptionHasUnsavedChanges) {
      const ok = window.confirm("Quitter sans enregistrer ?");
      if (!ok) return;
    }
    setExceptionDrawerOpen(false);
  }

  function openExceptionDrawer(dateIso: string) {
    exceptionDrawerRestoreFocusRef.current = document.activeElement as HTMLElement | null;
    setExceptionDate(dateIso);
    setExceptionService(enabledServices[0] ?? "PROMENADE");
    setExceptionError(null);

    exceptionFormLoadedKeyRef.current = "";
    setExceptionDrawerOpen(true);
  }

  useEffect(() => {
    if (!exceptionDrawerOpen) return;
    if (!exceptionDate) return;

    const key = `${exceptionDate}|${exceptionService}`;
    if (exceptionFormLoadedKeyRef.current === key) return;
    exceptionFormLoadedKeyRef.current = key;

    const existing = (exceptionsByService[exceptionService] ?? []).filter((e) => e.date === exceptionDate);
    if (existing.length) {
      const st = existing[0].status;
      setExceptionStatus(st === "UNAVAILABLE" ? "AVAILABLE" : st);
      const isAllDay = existing.length === 1 && existing[0].startMin === 0 && existing[0].endMin === 24 * 60;
      setExceptionAllDay(isAllDay);
      setExceptionRanges(
        isAllDay
          ? []
          : existing.map((r) => ({ startMin: r.startMin, endMin: r.endMin })).sort((a, b) => a.startMin - b.startMin)
      );
    } else {
      setExceptionStatus("AVAILABLE");
      setExceptionAllDay(true);
      setExceptionRanges([]);
    }

    exceptionDrawerInitialSnapshotRef.current = JSON.stringify({
      date: exceptionDate,
      service: exceptionService,
      status: existing.length ? (existing[0].status === "UNAVAILABLE" ? "AVAILABLE" : existing[0].status) : "AVAILABLE",
      allDay: existing.length ? existing.length === 1 && existing[0].startMin === 0 && existing[0].endMin === 24 * 60 : true,
      ranges:
        existing.length && !(existing.length === 1 && existing[0].startMin === 0 && existing[0].endMin === 24 * 60)
          ? existing.map((r) => ({ startMin: r.startMin, endMin: r.endMin })).sort((a, b) => a.startMin - b.startMin)
          : [],
    });
  }, [exceptionDate, exceptionDrawerOpen, exceptionService, exceptionsByService]);

  useEffect(() => {
    if (!exceptionDrawerOpen) {
      const el = exceptionDrawerRestoreFocusRef.current;
      if (el && typeof el.focus === "function") {
        try {
          el.focus();
        } catch {
          // ignore
        }
      }
      return;
    }

    const t = setTimeout(() => {
      const node = exceptionDrawerTitleRef.current;
      if (node && typeof (node as any).focus === "function") {
        (node as any).focus();
      }
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeExceptionDrawer();
        return;
      }

      if (e.key !== "Tab") return;
      const root = exceptionDrawerRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [exceptionDrawerOpen, exceptionHasUnsavedChanges, exceptionSaving]);

  useEffect(() => {
    void refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitterId, meta.fromIso, meta.toIso]);

  function statusTone(status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") {
    return status === "AVAILABLE" ? "bg-emerald-500" : status === "ON_REQUEST" ? "bg-amber-500" : "bg-slate-300";
  }

  const focusDayTone = (dateIso: string) => {
    const promenadeEnabled = configByService.PROMENADE?.enabled ?? true;
    const dogsittingEnabled = configByService.DOGSITTING?.enabled ?? true;
    const pensionEnabled = configByService.PENSION?.enabled ?? true;

    const promenadeBookable = promenadeEnabled && bookableDatesByService.PROMENADE.has(dateIso);
    const dogsittingBookable = dogsittingEnabled && bookableDatesByService.DOGSITTING.has(dateIso);
    const pensionBookable = pensionEnabled && bookableDatesByService.PENSION.has(dateIso);

    const isBookable = promenadeBookable || dogsittingBookable || pensionBookable;
    return isBookable
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : "bg-slate-100 text-slate-500 ring-slate-200";
  };

  if (!sitterId) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8">
        <p className="text-sm font-semibold text-slate-900">Disponibilités</p>
        <p className="mt-2 text-sm text-slate-600">Crée ton profil sitter pour configurer ton agenda.</p>
        <div className="mt-4">
          <Link href="/become-sitter" className="text-sm font-semibold text-[var(--dogshift-blue)]">
            Devenir sitter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10" style={{ scrollbarGutter: "stable" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900">Disponibilités</p>
          <p className="mt-2 text-sm text-slate-600">Configure tes services et tes exceptions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedPing ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
              🟢 {savedPing}
            </span>
          ) : null}
        </div>
      </div>

      {topError ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {topError.split("\n").map((line, i) => (
              <p key={`toperr-${i}`} className={i === 0 ? "text-sm font-semibold text-rose-900" : "mt-1 text-sm text-rose-900/80"}>
                {line}
              </p>
            ))}
          </div>
          <Link
            href="/host/profile/edit"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-900"
          >
            Ouvrir l’édition du profil
          </Link>
        </div>
      ) : null}

      {exceptionDrawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exception-drawer-title"
          aria-describedby="exception-drawer-desc"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeExceptionDrawer();
          }}
        >
          <div ref={exceptionDrawerRef} className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl max-h-[calc(100vh-2rem)]">
            <div className="shrink-0 border-b border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p
                    id="exception-drawer-title"
                    ref={exceptionDrawerTitleRef}
                    tabIndex={-1}
                    className="text-sm font-semibold text-slate-900"
                  >
                    {exceptionsForSelectedDate.length ? "Réservation" : "Ajouter une réservation"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{formatDateFrCh(exceptionDate)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => closeExceptionDrawer()}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  Fermer
                </button>
              </div>

              <p id="exception-drawer-desc" className="mt-3 text-xs font-semibold text-slate-500">
                Cette réservation remplace tes disponibilités habituelles pour cette date.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {exceptionsForSelectedDate.length ? (
                <div className="grid gap-2">
                  {exceptionsForSelectedDate.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">
                          <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200">
                            {serviceMeta(exceptionService).label}
                          </span>
                        </p>
                        <p className="text-xs font-semibold text-slate-500">{statusLabelFr(e.status)}</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {minutesToHHMM(e.startMin)}–{minutesToHHMM(e.endMin)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {e.startMin === 0 && e.endMin === 24 * 60 ? "Toute la journée" : `${minutesToHHMM(e.startMin)}–${minutesToHHMM(e.endMin)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        title="Supprimer cette disponibilité"
                        onClick={async () => {
                          setExceptionSaving(true);
                          setExceptionError(null);
                          try {
                            const res = await fetch("/api/sitters/me/availability-exceptions", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: e.id }),
                            });
                            const payload = (await res.json().catch(() => null)) as any;
                            if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "DELETE_ERROR");
                            await refetchAll();
                          } catch (err) {
                            setExceptionError(err instanceof Error ? err.message : "DELETE_ERROR");
                          } finally {
                            setExceptionSaving(false);
                          }
                        }}
                        disabled={exceptionSaving}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-60 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        aria-label="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={`${exceptionsForSelectedDate.length ? "mt-5" : ""} rounded-2xl border border-slate-200 bg-white p-4`}>
                <p className="text-sm font-semibold text-slate-900">{exceptionsForSelectedDate.length ? "Modifier" : "Créer"}</p>

                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                  <p>Disponible (acceptation automatique)</p>
                  <p className="mt-1">Sur demande (confirmation requise)</p>
                </div>

                <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Service</p>
                  <p className="mt-1 text-xs text-slate-600">Choisis pour quel service tu définis cette réservation.</p>

                  {enabledServices.length ? (
                    <div
                      className={`mt-3 grid gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200 ${
                        enabledServices.length === 1 ? "grid-cols-1" : enabledServices.length === 2 ? "grid-cols-2" : "grid-cols-3"
                      }`}
                    >
                      {enabledServices.map((svc) => {
                        const active = exceptionService === svc;
                        const tone = serviceDotTone(svc);
                        const baseTone = tone === "bg-sky-400" ? "bg-sky-500" : tone === "bg-violet-400" ? "bg-violet-500" : "bg-emerald-500";
                        return (
                          <button
                            key={`ex-svc-${svc}`}
                            type="button"
                            onClick={() => {
                              setExceptionError(null);
                              setExceptionService(svc);
                            }}
                            className={
                              active
                                ? `rounded-2xl ${baseTone} px-3 py-2 text-xs font-semibold text-white`
                                : "rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            }
                            aria-pressed={active}
                          >
                            {serviceMeta(svc).label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-slate-700">Active au moins un service pour ajouter une disponibilité.</p>
                  )}
                </div>

                <label className="text-xs font-semibold text-slate-700">
                  Statut
                  <select
                    value={exceptionStatus}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "AVAILABLE" || v === "ON_REQUEST") setExceptionStatus(v);
                    }}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    aria-label="Statut réservation"
                  >
                    <option value="AVAILABLE">Disponible</option>
                    <option value="ON_REQUEST">Sur demande</option>
                  </select>
                </label>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Durée</p>
                  <p className="mt-1 text-xs text-slate-600">Choisis si tu bloques toute la journée ou seulement certains horaires.</p>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
                    <button
                      type="button"
                      onClick={() => setExceptionAllDay(true)}
                      className={
                        exceptionAllDay
                          ? "rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2 text-xs font-semibold text-white"
                          : "rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      }
                      aria-pressed={exceptionAllDay}
                    >
                      Toute la journée
                    </button>

                    <button
                      type="button"
                      onClick={() => setExceptionAllDay(false)}
                      className={
                        !exceptionAllDay
                          ? "rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2 text-xs font-semibold text-white"
                          : "rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      }
                      aria-pressed={!exceptionAllDay}
                    >
                      Définir des horaires
                    </button>
                  </div>
                </div>

                {!exceptionAllDay ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Plages horaires</p>
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="grid max-h-56 gap-2 overflow-auto pr-1">
                        {exceptionRanges.length ? (
                          exceptionRanges.map((r, idx) => (
                            <div
                              key={`exr-${idx}`}
                              className={
                                justAddedRangeIdx === idx
                                  ? "flex items-center justify-between rounded-2xl border border-slate-200 bg-sky-50 px-3 py-2 transition-colors"
                                  : "flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 transition-colors"
                              }
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={minutesToHHMM(r.startMin)}
                                  step={1800}
                                  onChange={(e) => {
                                    const nextStart = hhmmToMinutes(e.target.value);
                                    if (nextStart === null) return;
                                    setExceptionRanges((prev) => {
                                      const next = prev.slice();
                                      next[idx] = { ...next[idx], startMin: nextStart };
                                      return next;
                                    });
                                  }}
                                  className="w-[92px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                                  aria-label={`Plage ${idx + 1} début`}
                                />
                                <span className="text-xs font-semibold text-slate-400" aria-hidden="true">
                                  →
                                </span>
                                <input
                                  type="time"
                                  value={minutesToHHMM(r.endMin)}
                                  step={1800}
                                  onChange={(e) => {
                                    const nextEnd = hhmmToMinutes(e.target.value);
                                    if (nextEnd === null) return;
                                    setExceptionRanges((prev) => {
                                      const next = prev.slice();
                                      next[idx] = { ...next[idx], endMin: nextEnd };
                                      return next;
                                    });
                                  }}
                                  className="w-[92px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                                  aria-label={`Plage ${idx + 1} fin`}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setExceptionRanges((prev) => {
                                    const next = prev.slice();
                                    next.splice(idx, 1);
                                    return next;
                                  })
                                }
                                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                                aria-label="Supprimer cette plage"
                              >
                                Supprimer
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-600">Aucune plage.</p>
                        )}
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setExceptionRanges((prev) => {
                              const next = [...prev, { startMin: 8 * 60, endMin: 9 * 60 }];
                              setJustAddedRangeIdx(next.length - 1);
                              setTimeout(() => setJustAddedRangeIdx(null), 700);
                              return next;
                            });
                          }}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
                        >
                          + Ajouter une plage
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!exceptionRangesValidation.ok ? (
                  <p className="text-sm font-semibold text-rose-700">{exceptionRangesValidation.error}</p>
                ) : null}

                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-5">
              {exceptionError ? <p className="mb-3 text-sm font-semibold text-rose-700">{exceptionError}</p> : null}

              <button
                type="button"
                onClick={async () => {
                  if (exceptionSaving) return;
                  setExceptionSaving(true);
                  setExceptionError(null);
                  try {
                    if (exceptionStatus === "UNAVAILABLE") throw new Error("INVALID_STATUS");

                    const normalized =
                      exceptionAllDay
                        ? { ok: true as const, ranges: [{ startMin: 0, endMin: 24 * 60 }] }
                        : normalizeRanges(exceptionRanges);
                    if (!normalized.ok) {
                      setExceptionError("Les plages se chevauchent.");
                      return;
                    }
                    const nextRanges = normalized.ranges;

                    const res = await fetch("/api/sitters/me/availability-exceptions", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        serviceType: exceptionService,
                        date: exceptionDate,
                        status: exceptionStatus,
                        ranges: normalized.ranges,
                      }),
                    });
                    const payload = (await res.json().catch(() => null)) as any;
                    if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "SAVE_ERROR");
                    await refetchAll();
                    exceptionDrawerInitialSnapshotRef.current = JSON.stringify({
                      date: exceptionDate,
                      service: exceptionService,
                      status: exceptionStatus,
                      allDay: exceptionAllDay,
                      ranges: nextRanges,
                    });
                    setExceptionDrawerOpen(false);
                  } catch (err) {
                    setExceptionError(err instanceof Error ? err.message : "SAVE_ERROR");
                  } finally {
                    setExceptionSaving(false);
                  }
                }}
                disabled={exceptionSaving || !enabledServices.length}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white disabled:opacity-60"
              >
                {exceptionSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error && !topError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-900">{error}</p>
        </div>
      ) : null}

      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
        <div ref={bookingInfoWrapRef} className="relative inline-block">
          <button
            type="button"
            onClick={() => setBookingInfoOpen((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"
            aria-haspopup="dialog"
            aria-expanded={bookingInfoOpen}
          >
            ⓘ Fonctionnement des réservations
          </button>

          {bookingInfoOpen ? (
            <div
              className="absolute left-0 top-full z-50 mt-2 w-[28rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white p-5 shadow-xl"
              role="dialog"
              aria-modal="false"
              aria-label="Fonctionnement des réservations"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Fonctionnement des réservations</p>
                <button
                  type="button"
                  onClick={() => setBookingInfoOpen(false)}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  Fermer
                </button>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-700">
                <div>
                  <ul className="mt-2 grid list-disc gap-2 pl-5">
                    <li>Tu configures ici tes services et tes exceptions de disponibilité.</li>
                    <li>Les tarifs doivent être définis avant de pouvoir activer un service.</li>
                    <li>Promenade et garde : CHF / heure. Pension : CHF / jour.</li>
                    <li>Les clients peuvent ensuite t’envoyer des demandes de réservation sur tes créneaux disponibles.</li>
                    <li>Les horaires pour les promenades et le dogsitting sont proposés toutes les 30 minutes.</li>
                    <li>15 minutes sont automatiquement bloquées avant et après chaque réservation pour te laisser le temps de t’organiser.</li>
                    <li>Les réservations doivent être faites au moins 24h à l’avance.</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Phase pilote</p>
                  <div className="mt-2 grid gap-1 text-sm text-slate-700">
                    <p>Les tarifs se règlent ici avant d’activer un service.</p>
                    <p>Promenade : 15–25 CHF / heure</p>
                    <p>Garde : 18–30 CHF / heure</p>
                    <p>Pension : 35–60 CHF / jour</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Pension</p>
                  <p className="mt-2">Pour la pension, les horaires d’arrivée et de départ dépendent des disponibilités que tu as définies.</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Column 1: Services */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-semibold text-slate-900">Services</p>
            <div className="grid gap-1 text-right text-[11px] font-semibold text-slate-500">
              <div className="flex items-center justify-end gap-2">
                <span className={`h-2 w-2 rounded-full ${serviceDotTone("PROMENADE")}`} aria-hidden="true" />
                <span>Promenade</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className={`h-2 w-2 rounded-full ${serviceDotTone("DOGSITTING")}`} aria-hidden="true" />
                <span>Dogsitting</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className={`h-2 w-2 rounded-full ${serviceDotTone("PENSION")}`} aria-hidden="true" />
                <span>Pension</span>
              </div>
            </div>
          </div>
          <div className="mt-4 -mx-5 overflow-hidden px-5">
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {(["PROMENADE", "DOGSITTING", "PENSION"] as const).map((svc) => {
              const metaSvc = serviceMeta(svc);
              const cfg = configByService[svc];
              const enabled = cfg?.enabled !== false;
              const tone = serviceDotTone(svc);
              const activeSwitchTone = tone === "bg-sky-400" ? "bg-sky-500" : tone === "bg-violet-400" ? "bg-violet-500" : "bg-emerald-500";
              const priceInput = pricingInputByService[svc] ?? "";
              const priceError = pricingErrorByService[svc];
              const priceSaving = pricingSavingByService[svc];
              const isActiveCard = availabilityTab === svc;
              return (
                <div
                  key={svc}
                  className="min-w-[320px] max-w-[360px] flex-none snap-center"
                >
                  <div
                  className={
                    isActiveCard
                      ? "rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-[0_10px_28px_-22px_rgba(15,23,42,0.25)] ring-2 ring-[color-mix(in_srgb,var(--dogshift-blue),white_65%)]"
                      : "rounded-3xl border border-slate-200 bg-white p-4 text-left"
                  }
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setAvailabilityTab(svc)}
                      className="text-left"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {metaSvc.icon} {metaSvc.label}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {isActiveCard ? "Service en cours de configuration" : "Configurer ce service"}
                      </p>
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      disabled={!enabled && Boolean(priceError)}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void saveServiceEnabled(svc, !enabled);
                      }}
                      className={
                        enabled
                          ? `relative inline-flex h-6 w-11 items-center rounded-full ${activeSwitchTone} transition`
                          : "relative inline-flex h-6 w-11 items-center rounded-full bg-slate-300 transition disabled:opacity-50"
                      }
                      aria-label={enabled ? `Désactiver ${metaSvc.label}` : `Activer ${metaSvc.label}`}
                    >
                      <span
                        className={
                          enabled
                            ? "inline-block h-5 w-5 translate-x-5 rounded-full bg-white shadow transition"
                            : "inline-block h-5 w-5 translate-x-1 rounded-full bg-white shadow transition"
                        }
                      />
                    </button>
                  </div>
                  {cfg ? null : <div className="mt-3 h-4 w-40 animate-pulse rounded bg-slate-100" />}

                  <div className="mt-3 grid gap-2">
                    <label className="text-xs font-semibold text-slate-500">Tarif</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={priceInput}
                        onChange={(e) => {
                          setPricingInputByService((prev) => ({ ...prev, [svc]: e.target.value }));
                        }}
                        inputMode="decimal"
                        placeholder="ex. 20"
                        className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
                      />
                      <span className="text-xs font-semibold text-slate-500">{pricingUnitLabel(svc)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void saveServicePricing(svc);
                        }}
                        disabled={priceSaving}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-60"
                      >
                        {priceSaving ? "..." : "OK"}
                      </button>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500">Fourchette pilote : {pricingRangeLabel(svc)}</p>
                    {priceError ? <p className="text-xs font-medium text-rose-600">{priceError}</p> : null}
                  </div>

                </div>
                </div>
              );
            })}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              {(["PROMENADE", "DOGSITTING", "PENSION"] as const).map((svc) => {
                const active = availabilityTab === svc;
                return <span key={`service-dot-${svc}`} className={active ? "h-2 w-2 rounded-full bg-slate-900" : "h-2 w-2 rounded-full bg-slate-300"} aria-hidden="true" />;
              })}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-sm font-semibold text-slate-900">Disponibilités</p>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
              {(["PROMENADE", "DOGSITTING", "PENSION"] as const).map((svc) => {
                const active = availabilityTab === svc;
                const tone = serviceDotTone(svc);
                const baseTone = tone === "bg-sky-400" ? "bg-sky-500" : tone === "bg-violet-400" ? "bg-violet-500" : "bg-emerald-500";
                const disabled = (configByService[svc]?.enabled ?? true) === false || Boolean(pricingErrorByService[svc]);
                return (
                  <button
                    key={`tab-${svc}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => setAvailabilityTab(svc)}
                    className={
                      active
                        ? `rounded-2xl ${baseTone} px-3 py-2 text-xs font-semibold text-white`
                        : "rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                    }
                    aria-pressed={active}
                  >
                    {serviceMeta(svc).label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              {!canEditAvailabilityForTab ? (
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-900">
                    {(configByService[availabilityTab]?.enabled ?? true) === false
                      ? "Active d’abord ce service pour modifier ses disponibilités."
                      : pricingErrorByService[availabilityTab] ?? "Ajoute un tarif valide pour modifier les disponibilités."}
                  </p>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {serviceMeta(availabilityTab).icon} {serviceMeta(availabilityTab).label}
                  </p>
                  <span className={`h-2 w-2 rounded-full ${serviceDotTone(availabilityTab)}`} aria-hidden="true" />
                </div>
                <button
                  type="button"
                  onClick={() => setQuickActionsOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  aria-expanded={quickActionsOpen}
                  aria-controls="availability-quick-actions"
                >
                  <span>Actions rapides</span>
                  <span className="inline-block w-3 text-center" aria-hidden="true">
                    {quickActionsOpen ? "⌃" : "⌄"}
                  </span>
                </button>
              </div>

              <div
                id="availability-quick-actions"
                className={`mt-3 w-full overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${quickActionsOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
              >
                <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-0">
                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void applyQuickAction("all-available-week");
                        }}
                        disabled={quickActionSaving !== null || !canEditAvailabilityForTab}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                      >
                        {quickActionSaving === "all-available-week" ? "Enregistrement…" : "Tout disponible cette semaine"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void applyQuickAction("all-available-month");
                        }}
                        disabled={quickActionSaving !== null || !canEditAvailabilityForTab}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                      >
                        {quickActionSaving === "all-available-month" ? "Enregistrement…" : "Tout disponible ce mois"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void applyQuickAction("copy-week");
                        }}
                        disabled={quickActionSaving !== null || !canEditAvailabilityForTab}
                        className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                      >
                        {quickActionSaving === "copy-week" ? "Enregistrement…" : "Reproduire cette semaine sur le reste du mois"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-1.5">
                {(() => {
                  if (!configByService[availabilityTab]) return <p className="text-sm text-slate-600">Chargement…</p>;
                  return (
                    <div className="grid gap-1.5">
                      {weeklyDayOptions.map((day) => {
                        const rule = weeklyRulesForTab.get(day.dayOfWeek) ?? { enabled: false, status: "AVAILABLE" as const };
                        const isSaving = weeklySavingKey === `${availabilityTab}-${day.dayOfWeek}`;
                        return (
                          <div key={`${availabilityTab}-${day.dayOfWeek}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <label className="flex min-w-0 items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={rule.enabled}
                                disabled={isSaving || !canEditAvailabilityForTab}
                                onChange={(e) => {
                                  void saveWeeklyRule(availabilityTab, day.dayOfWeek, e.currentTarget.checked, rule.status);
                                }}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-[var(--dogshift-blue)] focus:ring-[var(--dogshift-blue)]"
                              />
                              <span className="text-sm font-medium text-slate-900">{day.label}</span>
                            </label>

                            <div className="flex items-center gap-2">
                              <select
                                value={rule.status}
                                disabled={!rule.enabled || isSaving || !canEditAvailabilityForTab}
                                onChange={(e) => {
                                  const nextStatus = e.currentTarget.value === "ON_REQUEST" ? "ON_REQUEST" : "AVAILABLE";
                                  void saveWeeklyRule(availabilityTab, day.dayOfWeek, true, nextStatus);
                                }}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                <option value="AVAILABLE">Disponible</option>
                                <option value="ON_REQUEST">Sur demande</option>
                              </select>

                              {isSaving ? <span className="text-xs font-semibold text-slate-500">Enregistrement…</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

          </div>
        </div>

        {/* Column 2: Exceptions + preview calendar */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Agenda des disponibilités</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void resetCurrentMonth();
                }}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700"
              >
                Réinitialiser ce mois
              </button>
              <button
                type="button"
                onClick={() => setMonthCursor((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1, 12, 0, 0, 0)))}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                aria-label="Mois précédent"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => setMonthCursor((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12, 0, 0, 0)))}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                aria-label="Mois suivant"
              >
                ▶
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-900">{meta.monthLabel}</p>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-slate-500">
              <div>L</div>
              <div>M</div>
              <div>M</div>
              <div>J</div>
              <div>V</div>
              <div>S</div>
              <div>D</div>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: meta.mondayIndex }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {Array.from({ length: meta.daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateIso = `${String(meta.year).padStart(4, "0")}-${String(meta.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const status = effectiveStatusForDate(dateIso, availabilityTab);
                const tone = statusCellTone(status);
                const isPast = dateIso < todayKeyZurich;

                return (
                  <button
                    key={dateIso}
                    type="button"
                    disabled={isPast || !canEditAvailabilityForTab}
                    onClick={() => {
                      if (isPast || !canEditAvailabilityForTab) return;
                      openInlineException(dateIso);
                    }}
                    className={
                      isPast
                        ? `flex h-12 w-full flex-col justify-between rounded-2xl ring-1 ${tone} cursor-not-allowed px-2 py-1 opacity-40`
                        : `flex h-12 w-full flex-col justify-between rounded-2xl ring-1 ${tone} px-2 py-1 hover:ring-2`
                    }
                    aria-label={`Disponibilité ${formatDateFrCh(dateIso)}`}
                  >
                    <div className="flex items-start justify-end">
                      <span className="text-sm font-semibold leading-none text-slate-900">{day}</span>
                    </div>

                    <div className="flex items-center justify-center gap-1">
                      {status === "AVAILABLE" || status === "ON_REQUEST" ? (
                        <span className={`h-2 w-2 rounded-full ${serviceDotTone(availabilityTab)}`} aria-hidden="true" />
                      ) : (
                        <span className="text-[10px] font-semibold leading-none text-slate-400">—</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {inlineExceptionOpen && exceptionDate ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Date sélectionnée</p>
                  <p className="mt-1 text-sm text-slate-600">{formatDateFrCh(exceptionDate)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInlineExceptionOpen(false)}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(["PROMENADE", "DOGSITTING", "PENSION"] as const).map((svc) => {
                  const active = exceptionService === svc;
                  const disabled = (configByService[svc]?.enabled ?? true) === false || Boolean(pricingErrorByService[svc]);
                  return (
                    <button
                      key={`inline-service-${svc}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setExceptionService(svc);
                        setAvailabilityTab(svc);
                        const existing = (exceptionsByService[svc] ?? []).filter((e) => e.date === exceptionDate).sort((a, b) => a.startMin - b.startMin);
                        const isAllDay = existing.length === 1 && existing[0]?.startMin === 0 && existing[0]?.endMin === 24 * 60;
                        setExceptionStatus(existing[0]?.status ?? effectiveStatusForDate(exceptionDate, svc));
                        setExceptionAllDay(existing.length ? isAllDay : true);
                        setExceptionRanges(
                          existing.length && !isAllDay
                            ? existing.map((row) => ({ startMin: row.startMin, endMin: row.endMin })).sort((a, b) => a.startMin - b.startMin)
                            : []
                        );
                        setExceptionError(null);
                      }}
                      className={
                        active
                          ? `rounded-2xl border px-3 py-2 text-xs font-semibold disabled:opacity-45 ${serviceSolidTone(svc)}`
                          : "rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                      }
                    >
                      {serviceMeta(svc).label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(["AVAILABLE", "ON_REQUEST", "UNAVAILABLE"] as const).map((status) => {
                  const active = exceptionStatus === status;
                  return (
                    <button
                      key={`inline-status-${status}`}
                      type="button"
                      onClick={() => setExceptionStatus(status)}
                      className={
                        active
                          ? "rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2 text-xs font-semibold text-white"
                          : "rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      }
                      aria-pressed={active}
                    >
                      {statusLabelFr(status)}
                    </button>
                  );
                })}
              </div>

              {serviceSupportsTimeSlots(exceptionService) && exceptionStatus !== "UNAVAILABLE" ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Horaires</p>
                  <p className="mt-1 text-xs text-slate-600">Choisis si ce service est disponible toute la journée ou seulement sur certains créneaux.</p>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
                    <button
                      type="button"
                      onClick={() => setExceptionAllDay(true)}
                      className={
                        exceptionAllDay
                          ? "rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2 text-xs font-semibold text-white"
                          : "rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      }
                      aria-pressed={exceptionAllDay}
                    >
                      Toute la journée
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExceptionAllDay(false);
                        setExceptionRanges((prev) => (prev.length ? prev : [{ startMin: 8 * 60, endMin: 10 * 60 }]));
                      }}
                      className={
                        !exceptionAllDay
                          ? "rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2 text-xs font-semibold text-white"
                          : "rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      }
                      aria-pressed={!exceptionAllDay}
                    >
                      Définir des horaires
                    </button>
                  </div>

                  {!exceptionAllDay ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-slate-500">Créneaux horaires</p>
                      <div className="mt-2 grid gap-2">
                        {exceptionRanges.length ? (
                          exceptionRanges.map((range, idx) => (
                            <div
                              key={`inline-range-${idx}`}
                              className={
                                justAddedRangeIdx === idx
                                  ? "flex items-center justify-between rounded-2xl border border-slate-200 bg-sky-50 px-3 py-2"
                                  : "flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                              }
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={minutesToHHMM(range.startMin)}
                                  step={1800}
                                  onChange={(e) => {
                                    const nextStart = hhmmToMinutes(e.target.value);
                                    if (nextStart === null) return;
                                    setExceptionRanges((prev) => {
                                      const next = prev.slice();
                                      next[idx] = { ...next[idx], startMin: nextStart };
                                      return next;
                                    });
                                  }}
                                  className="w-[96px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                                  aria-label={`Créneau ${idx + 1} début`}
                                />
                                <span className="text-xs font-semibold text-slate-400">→</span>
                                <input
                                  type="time"
                                  value={minutesToHHMM(range.endMin)}
                                  step={1800}
                                  onChange={(e) => {
                                    const nextEnd = hhmmToMinutes(e.target.value);
                                    if (nextEnd === null) return;
                                    setExceptionRanges((prev) => {
                                      const next = prev.slice();
                                      next[idx] = { ...next[idx], endMin: nextEnd };
                                      return next;
                                    });
                                  }}
                                  className="w-[96px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                                  aria-label={`Créneau ${idx + 1} fin`}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setExceptionRanges((prev) => {
                                    const next = prev.slice();
                                    next.splice(idx, 1);
                                    return next;
                                  });
                                }}
                                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                              >
                                Supprimer
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-600">Aucun créneau.</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setExceptionRanges((prev) => {
                            const next = [...prev, { startMin: 14 * 60, endMin: 16 * 60 }];
                            setJustAddedRangeIdx(next.length - 1);
                            setTimeout(() => setJustAddedRangeIdx(null), 700);
                            return next;
                          });
                        }}
                        className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
                      >
                        + Ajouter un créneau
                      </button>

                      {!exceptionRangesValidation.ok ? <p className="mt-3 text-sm font-semibold text-rose-700">{exceptionRangesValidation.error}</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="mt-3 text-xs font-semibold text-slate-500">
                Cette exception remplace la règle hebdomadaire pour le service {serviceMeta(exceptionService).label.toLowerCase()}.
              </p>

              {exceptionError ? <p className="mt-3 text-sm font-semibold text-rose-700">{exceptionError}</p> : null}

              <button
                type="button"
                onClick={() => {
                  void saveSingleDayException(exceptionService, exceptionDate, exceptionStatus);
                }}
                disabled={exceptionSaving}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white disabled:opacity-60"
              >
                {exceptionSaving ? "Enregistrement…" : "Appliquer uniquement à cette date"}
              </button>
            </div>
          ) : null}

        </div>
      </div>

      {loading ? <div className="fixed bottom-6 right-6 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Chargement…</div> : null}
    </div>
  );
}
