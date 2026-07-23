"use client";

// Availability page talks to a large JSON API that evolves (availability rules,
// date exceptions, pricing, last-minute settings); payload shapes come from
// network responses so we use `any` narrowly when handling those. A few
// presentational helpers are exported for future iterations and not yet
// consumed in this file. Disabling those two rules here keeps the diff tight.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Info, X, Settings, Banknote, Clock, ShieldCheck, Home, Rocket, RotateCw, Footprints, Moon, ChevronLeft, ChevronRight, Eraser } from "lucide-react";
import { useIsNativeAppSync } from "@/lib/native/useIsNativeAppSync";

import { useHostUser } from "@/components/HostUserProvider";
import { normalizeRanges } from "@/lib/availability/rangeValidation";
import type { HostProfileV1 } from "@/lib/hostProfile";
import { apiErrorMessage } from "@/lib/errors/apiErrorMessage";

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
  // Delegate to the shared API error translator so we never surface raw
  // ALL_CAPS codes to end users. Returns a generic French message for
  // unknown codes instead of leaking e.g. "SAVE_ERROR".
  return apiErrorMessage(code);
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

const TIME_PICKER_OPTIONS = Array.from({ length: 48 }, (_, idx) => idx * 30);

function serviceMeta(svc: ServiceTypeApi) {
  if (svc === "PROMENADE") return { icon: "🚶", label: "Promenade" };
  if (svc === "DOGSITTING") return { icon: "🏠", label: "Dogsitting" };
  return { icon: "🛌", label: "Pension" };
}

// Native service icon (replaces emojis for a cleaner look).
function ServiceIcon({ svc, className }: { svc: ServiceTypeApi; className?: string }) {
  if (svc === "PROMENADE") return <Footprints className={className} aria-hidden="true" />;
  if (svc === "DOGSITTING") return <Home className={className} aria-hidden="true" />;
  return <Moon className={className} aria-hidden="true" />;
}

// Per-service colour code (mirrors the website): Promenade = sky, Dogsitting =
// violet, Pension = emerald. Status colours (green = available, amber = on
// request) are separate and untouched.
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

function pricingPlaceholderLabel(svc: ServiceTypeApi) {
  if (svc === "PROMENADE") return "ex. 20";
  if (svc === "DOGSITTING") return "ex. 24";
  return "ex. 45";
}

function statusCellTone(status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") {
  if (status === "AVAILABLE") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (status === "ON_REQUEST") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-slate-100 text-slate-500 ring-slate-200";
}

function serviceSupportsTimeSlots(svc: ServiceTypeApi) {
  return svc === "PROMENADE" || svc === "DOGSITTING";
}

function isServiceSelectionDisabled(
  svc: ServiceTypeApi,
  configByService: Partial<Record<ServiceTypeApi, ServiceConfig | null>>,
  pricingErrorByService: Partial<Record<ServiceTypeApi, string | null | undefined>>
) {
  return configByService[svc]?.enabled !== true || Boolean(pricingErrorByService[svc]);
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

function globalDayStatus(
  row:
    | {
        promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
        dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
        pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
      }
    | undefined
) {
  if (!row) return "UNAVAILABLE" as const;
  if (row.promenadeStatus === "AVAILABLE" || row.dogsittingStatus === "AVAILABLE" || row.pensionStatus === "AVAILABLE") {
    return "AVAILABLE" as const;
  }
  if (row.promenadeStatus === "ON_REQUEST" || row.dogsittingStatus === "ON_REQUEST" || row.pensionStatus === "ON_REQUEST") {
    return "ON_REQUEST" as const;
  }
  return "UNAVAILABLE" as const;
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
  const isNative = useIsNativeAppSync();
  const [availFlipped, setAvailFlipped] = useState(false);
  const [monthClearConfirm, setMonthClearConfirm] = useState(false);
  const host = useHostUser();
  const sitterId = host.sitterId;
  const remoteProfile = (host.profile && typeof host.profile === "object" ? (host.profile as Partial<HostProfileV1>) : null);

  const [lastMinuteEnabledGlobal, setLastMinuteEnabledGlobal] = useState<boolean | null>(null);
  const [lastMinuteSavingGlobal, setLastMinuteSavingGlobal] = useState(false);
  const [lastMinutePhonePresent, setLastMinutePhonePresent] = useState<boolean | null>(null);

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

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPing, setSavedPing] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [bookingInfoOpen, setBookingInfoOpen] = useState(false);
  const bookingInfoWrapRef = useRef<HTMLDivElement | null>(null);
  const quickActionsWrapRef = useRef<HTMLDivElement | null>(null);

  const [availabilityTab, setAvailabilityTab] = useState<ServiceTypeApi>("PROMENADE");
  const [servicesCarouselIndex, setServicesCarouselIndex] = useState(0);

  const todayKeyZurich = useMemo(() => toZurichIsoDate(new Date()), []);

  const [exceptionDrawerOpen, setExceptionDrawerOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState<string>("");
  const [exceptionService, setExceptionService] = useState<ServiceTypeApi>("PROMENADE");
  const [exceptionStatus, setExceptionStatus] = useState<"AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE">("AVAILABLE");
  const [exceptionAllDay, setExceptionAllDay] = useState(true);
  const [exceptionRanges, setExceptionRanges] = useState<Array<{ startMin: number; endMin: number }>>([]);
  const [justAddedRangeIdx, setJustAddedRangeIdx] = useState<number | null>(null);
  const [activeTimePicker, setActiveTimePicker] = useState<null | { idx: number; field: "startMin" | "endMin" }>(null);
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [weeklySavingKey, setWeeklySavingKey] = useState<string | null>(null);
  // Tracks how many weekly-rule saves are currently in-flight (for any service).
  // Prevents concurrent saves that could cause race conditions in the calendar.
  const ruleSaveCountRef = useRef(0);
  const [anyRuleSaving, setAnyRuleSaving] = useState(false);
  const [quickActionSaving, setQuickActionSaving] = useState<string | null>(null);
  const [inlineExceptionOpen, setInlineExceptionOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const exceptionFormLoadedKeyRef = useRef<string>("");
  const activeTimePickerRef = useRef<HTMLDivElement | null>(null);

  const exceptionDrawerTitleRef = useRef<HTMLParagraphElement | null>(null);
  const exceptionDrawerRef = useRef<HTMLDivElement | null>(null);
  const exceptionDrawerRestoreFocusRef = useRef<HTMLElement | null>(null);
  const exceptionDrawerInitialSnapshotRef = useRef<string>("");

  async function refetchLastMinuteGlobal() {
    try {
      const res = await fetch("/api/sitters/me/last-minute", { method: "GET", cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "LAST_MINUTE_ERROR");
      setLastMinuteEnabledGlobal(Boolean(payload.lastMinuteEnabled));
      setLastMinutePhonePresent(typeof payload.phonePresent === "boolean" ? payload.phonePresent : null);
    } catch {
      setLastMinuteEnabledGlobal(null);
      setLastMinutePhonePresent(null);
    }
  }

  // Applies a full availability-init payload to all state at once (single render).
  function applyInitPayload(payload: any) {
    const services: ServiceTypeApi[] = ["PROMENADE", "DOGSITTING", "PENSION"];

    const nextConfig: Record<ServiceTypeApi, ServiceConfig | null> = { PROMENADE: null, DOGSITTING: null, PENSION: null };
    for (const svc of services) {
      const cfg = payload?.configs?.[svc];
      if (cfg && typeof cfg.enabled === "boolean") nextConfig[svc] = { enabled: cfg.enabled };
    }

    const nextExceptions: Record<ServiceTypeApi, ExceptionRow[]> = { PROMENADE: [], DOGSITTING: [], PENSION: [] };
    for (const svc of services) {
      const excs = payload?.exceptions?.[svc];
      if (Array.isArray(excs)) nextExceptions[svc] = excs as ExceptionRow[];
    }

    const nextRules: Record<ServiceTypeApi, AvailabilityRuleRow[]> = { PROMENADE: [], DOGSITTING: [], PENSION: [] };
    for (const svc of services) {
      const rules = payload?.rules?.[svc];
      if (Array.isArray(rules)) nextRules[svc] = rules as AvailabilityRuleRow[];
    }

    // Apply all state updates — React 18 batches them automatically into one render
    setConfigByService(nextConfig);
    setExceptionsByService(nextExceptions);
    setRulesByService(nextRules);
    if (Array.isArray(payload?.days)) setMonthDays(payload.days);
    if (typeof payload?.lastMinuteEnabled === "boolean") setLastMinuteEnabledGlobal(payload.lastMinuteEnabled);
    if (typeof payload?.phonePresent === "boolean") setLastMinutePhonePresent(payload.phonePresent);
    setInitialLoaded(true);
  }

  async function saveLastMinuteGlobal(next: boolean) {
    setLastMinuteSavingGlobal(true);
    setError(null);
    setTopError(null);
    const prev = lastMinuteEnabledGlobal;
    setLastMinuteEnabledGlobal(next);
    try {
      const res = await fetch("/api/sitters/me/last-minute", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastMinuteEnabled: next }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        const msg = typeof payload?.message === "string" && payload.message.trim() ? payload.message.trim() : payload?.error ?? "SAVE_ERROR";
        throw new Error(msg);
      }
      await refetchLastMinuteGlobal();
    } catch (e) {
      await refetchLastMinuteGlobal();
      setLastMinuteEnabledGlobal(prev ?? false);
      setError(errorMessageFr(e instanceof Error ? e.message : "SAVE_ERROR"));
    } finally {
      setLastMinuteSavingGlobal(false);
    }
  }

  const monthStatusByDate = useMemo(() => {
    const map = new Map<string, (typeof monthDays)[number]>();
    for (const row of monthDays) map.set(row.date, row);
    return map;
  }, [monthDays]);

  const enabledServices = useMemo(() => {
    const services: ServiceTypeApi[] = ["PROMENADE", "DOGSITTING", "PENSION"];
    return services.filter((svc) => configByService[svc]?.enabled === true);
  }, [configByService]);

  useEffect(() => {
    const order: ServiceTypeApi[] = ["PROMENADE", "DOGSITTING", "PENSION"];
    const idx = order.indexOf(availabilityTab);
    if (idx >= 0) setServicesCarouselIndex(idx);
  }, [availabilityTab]);

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
    const check = (svc: ServiceTypeApi, key: PricingServiceKey) => {
      const input = pricingInputByService[svc];
      if (input !== undefined && input !== "") {
        const parsed = parsePrice(input);
        if (parsed !== null) return getTariffRangeError(key, parsed) ?? null;
      }
      if (pricingByService[svc] === undefined) return "Ajoute un prix pour activer ce service.";
      return getTariffRangeError(key, pricingByService[svc]!) ?? null;
    };
    return {
      PROMENADE: check("PROMENADE", "Promenade"),
      DOGSITTING: check("DOGSITTING", "Garde"),
      PENSION: check("PENSION", "Pension"),
    } satisfies Record<ServiceTypeApi, string | null>;
  }, [pricingByService, pricingInputByService]);

  const canEditAvailabilityForTab = useMemo(() => {
    return (configByService[availabilityTab]?.enabled === true) && !pricingErrorByService[availabilityTab];
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
    if (!quickActionsOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const root = quickActionsWrapRef.current;
      const target = e.target as Node | null;
      if (!root || !target) return;
      if (!root.contains(target)) setQuickActionsOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, [quickActionsOpen]);

  useEffect(() => {
    if (!activeTimePicker) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!activeTimePickerRef.current) return;
      const target = e.target as Node | null;
      if (target && !activeTimePickerRef.current.contains(target)) {
        setActiveTimePicker(null);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveTimePicker(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeTimePicker]);

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
  const pricingDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function saveServiceEnabled(svc: ServiceTypeApi, enabled: boolean) {
    if (!sitterId) return;
    if (enabled) {
      clearTimeout(pricingDebounceRef.current[svc]);
      const input = pricingInputByService[svc] ?? "";
      const parsed = parsePrice(input);
      if (parsed !== null && pricingByService[svc] !== parsed) {
        const pricingKey = pricingKeyForService(svc);
        const nextAll: Record<PricingServiceKey, number | null> = {
          Promenade: pricingByService.PROMENADE ?? null,
          Garde: pricingByService.DOGSITTING ?? null,
          Pension: pricingByService.PENSION ?? null,
        };
        nextAll[pricingKey] = parsed;
        try {
          const res = await fetch("/api/host/profile/pricing", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pricing: nextAll }),
          });
          const payload = (await res.json().catch(() => null)) as { ok?: boolean } | null;
          if (res.ok && payload?.ok) {
            setPricingByService((prev) => ({ ...prev, [svc]: parsed ?? undefined }));
          }
        } catch { /* proceed anyway */ }
      }
      const inputVal = pricingInputByService[svc] ?? "";
      const parsedNow = parsePrice(inputVal);
      if (parsedNow === null && pricingByService[svc] === undefined) {
        setTopError(errorMessageFr("PRICING_REQUIRED"));
        return;
      }
    }
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
      if (code !== "PRICING_REQUIRED") setError(errorMessageFr(e instanceof Error ? e.message : "SAVE_ERROR"));
    } finally {
      setLoading(false);
    }
  }

  async function saveServicePricing(svc: ServiceTypeApi, rawOverride?: string) {
    if (!sitterId) return;
    const raw = rawOverride !== undefined ? rawOverride : (pricingInputByService[svc] ?? "");
    const parsed = parsePrice(raw);
    const pricingKey = pricingKeyForService(svc);
    const rangeError = parsed !== null ? getTariffRangeError(pricingKey, parsed) : null;
    const isValid = parsed !== null && !rangeError;

    const currentlyEnabled = configByService[svc]?.enabled === true;

    if (!isValid && currentlyEnabled) {
      setConfigByService((prev) => {
        const n = { ...prev };
        (n as any)[svc] = { ...(prev[svc] ?? {}), enabled: false };
        return n;
      });
      fetch(`/api/sitters/me/service-config?service=${encodeURIComponent(svc)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }).catch(() => {});
    }

    if (isValid) {
      setPricingByService((prev) => ({ ...prev, [svc]: parsed! }));
    } else {
      setPricingByService((prev) => {
        const n = { ...prev };
        delete (n as any)[svc];
        return n;
      });
    }

    setPricingSavingByService((prev) => ({ ...prev, [svc]: true }));
    try {
      const nextAll: Record<PricingServiceKey, number | null> = {
        Promenade: pricingByService.PROMENADE ?? null,
        Garde: pricingByService.DOGSITTING ?? null,
        Pension: pricingByService.PENSION ?? null,
      };
      nextAll[pricingKey] = parsed;
      await fetch("/api/host/profile/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing: nextAll }),
      });
    } catch {
      // pricing save is best-effort; toggle already handled above
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
      // Single request: the server fetches all DB data in parallel and computes the calendar.
      // Previously this was 11 HTTP requests in 5 sequential waves; now it is 1 request.
      const qp = new URLSearchParams({ from: meta.fromIso, to: meta.toIso });
      const res = await fetch(`/api/sitters/me/availability-init?${qp.toString()}`, { method: "GET", cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "INIT_ERROR");
      if (token !== refreshTokenRef.current) return;

      // Apply all state updates at once — React 18 batches them into a single re-render.
      applyInitPayload(payload);

      setSavedPing("Synchronisé avec l'agenda public");
      setTimeout(() => setSavedPing(null), 1800);
    } catch (e) {
      if (token !== refreshTokenRef.current) return;
      setError(errorMessageFr(e instanceof Error ? e.message : "ERROR"));
    } finally {
      if (token !== refreshTokenRef.current) return;
      setLoading(false);
    }
  }

  async function saveWeeklyRule(svc: ServiceTypeApi, dayOfWeek: number, enabled: boolean, status: "AVAILABLE" | "ON_REQUEST") {
    if (!sitterId) return;

    // Increment the in-flight counter before any async work so the UI can
    // immediately disable other checkboxes (prevents concurrent saves that
    // could race against each other and produce stale calendar state).
    ruleSaveCountRef.current += 1;
    setAnyRuleSaving(true);
    setLoading(true);
    setError(null);
    setTopError(null);
    setWeeklySavingKey(`${svc}-${dayOfWeek}`);

    // Optimistic update for the weekly-rules toggle
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

    // Optimistic update for the calendar grid so it reflects the change immediately
    // without waiting for refetchAll. refetchAll will overwrite with authoritative data.
    const svcStatusKey =
      svc === "PROMENADE" ? "promenadeStatus" : svc === "DOGSITTING" ? "dogsittingStatus" : "pensionStatus";
    const excMapForSvc = new Map<string, "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE">();
    for (const exc of exceptionsByService[svc] ?? []) {
      if (exc.date) excMapForSvc.set(exc.date, exc.status);
    }
    setMonthDays((prev) =>
      prev.map((row) => {
        if (!row?.date) return row;
        const rowDow = new Date(`${row.date}T12:00:00Z`).getUTCDay();
        if (rowDow !== dayOfWeek) return row;
        if (excMapForSvc.has(row.date)) return row;
        const newStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE" = enabled
          ? status === "ON_REQUEST" ? "ON_REQUEST" : "AVAILABLE"
          : "UNAVAILABLE";
        return { ...row, [svcStatusKey]: newStatus };
      })
    );

    let saveError: string | null = null;
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
    } catch (e) {
      const code = e instanceof Error ? e.message : "SAVE_ERROR";
      saveError = code;
      if (code === "PRICING_REQUIRED") {
        setTopError(errorMessageFr(code));
        setError(null);
      } else {
        setError(errorMessageFr(code));
      }
    } finally {
      setWeeklySavingKey(null);
      setLoading(false);

      // Decrement counter; when it reaches 0 all in-flight saves are done and
      // we do a single authoritative refetch to reconcile the calendar with the DB.
      ruleSaveCountRef.current -= 1;
      if (ruleSaveCountRef.current <= 0) {
        ruleSaveCountRef.current = 0;
        setAnyRuleSaving(false);
        await refetchAll();
      }
    }

    // Suppress unused variable warning — saveError is used for side effects above.
    void saveError;
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
    const svc = enabledServices.includes(availabilityTab) ? availabilityTab : enabledServices[0] ?? "PROMENADE";
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

  function selectInlineExceptionService(svc: ServiceTypeApi) {
    setExceptionService(svc);
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

  async function applyQuickAction(action: "all-available-week" | "all-available-month" | "copy-week" | "clear-month") {
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
      } else if (action === "clear-month") {
        for (const date of dates) statusByDate.set(date, "UNAVAILABLE");
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
        setError(errorMessageFr(code));
      }
    } finally {
      setQuickActionSaving(null);
    }
  }

  async function resetAllAvailability() {
    if (!sitterId) return;
    setResetConfirmOpen(false);
    setLoading(true);
    setError(null);
    setTopError(null);
    try {
      const res = await fetch("/api/sitters/me/availability-reset", { method: "POST" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "RESET_ERROR");

      // Optimistically clear all local state so the UI responds immediately
      setRulesByService({ PROMENADE: [], DOGSITTING: [], PENSION: [] });
      setExceptionsByService({ PROMENADE: [], DOGSITTING: [], PENSION: [] });
      setMonthDays((prev) =>
        prev.map((row) => ({
          ...row,
          promenadeStatus: "UNAVAILABLE" as const,
          dogsittingStatus: "UNAVAILABLE" as const,
          pensionStatus: "UNAVAILABLE" as const,
        }))
      );

      await refetchAll();
    } catch (e) {
      setError(errorMessageFr(e instanceof Error ? e.message : "RESET_ERROR"));
      await refetchAll();
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
    setActiveTimePicker(null);
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
    // closeExceptionDrawer is referenced via the keydown handler closure; its
    // identity changes on every render but calling it with a stale reference
    // is safe (it just closes the drawer). Pinning deps to the inputs we
    // actually branch on avoids re-binding listeners on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exceptionDrawerOpen, exceptionHasUnsavedChanges, exceptionSaving]);

  useEffect(() => {
    void refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitterId, meta.fromIso, meta.toIso]);

  function statusTone(status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") {
    return status === "AVAILABLE" ? "bg-emerald-500" : status === "ON_REQUEST" ? "bg-amber-500" : "bg-slate-300";
  }

  const focusDayTone = (dateIso: string) => {
    const promenadeEnabled = configByService.PROMENADE?.enabled === true;
    const dogsittingEnabled = configByService.DOGSITTING?.enabled === true;
    const pensionEnabled = configByService.PENSION?.enabled === true;

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
      <div className="ds-card rounded-3xl border border-slate-200 bg-white p-8">
        <p className="text-sm font-semibold text-slate-900">Disponibilités</p>
        <p className="mt-2 text-sm text-slate-600">Crée ton profil sitter pour configurer ton agenda.</p>
        <div className="mt-4">
          <Link href="/devenir-dogsitter" className="text-sm font-semibold text-[var(--dogshift-blue)]">
            Devenir sitter
          </Link>
        </div>
      </div>
    );
  }

  // Skeleton shown only on the very first load before any data arrives.
  // Native uses a single spinner (founder: no skeleton inside the popups).
  if (!initialLoaded) {
    if (isNative) {
      return (
        <div className="flex min-h-[55vh] items-center justify-center" data-testid="host-availability-page">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
        </div>
      );
    }
    return (
      <div className="w-full py-6 animate-pulse" aria-busy="true" aria-label="Chargement des disponibilités…">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="h-7 w-40 rounded-xl bg-slate-200" />
            <div className="mt-2 h-4 w-64 rounded-lg bg-slate-100" />
          </div>
        </div>
        {/* Services skeleton */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded-lg bg-slate-200" />
                <div className="h-6 w-10 rounded-full bg-slate-200" />
              </div>
              <div className="mt-3 h-8 w-20 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
        {/* Calendar skeleton */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="h-5 w-32 rounded-lg bg-slate-200" />
          <div className="mt-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-12 rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
        {/* Weekly rules skeleton */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="h-5 w-48 rounded-lg bg-slate-200" />
          <div className="mt-4 grid gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-11 rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isNative) {
    const svcTabs = ["PROMENADE", "DOGSITTING", "PENSION"] as const;
    const priceInput = pricingInputByService[availabilityTab];
    return (
      <div className="space-y-4 pb-2" data-testid="host-availability-page">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Clock className="h-6 w-6 text-[#7c3aed]" aria-hidden="true" />
            <span>Disponibilités</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthClearConfirm(true)}
              aria-label="Réinitialiser le mois"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-95"
            >
              <Eraser className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setAvailFlipped((v) => !v)}
              aria-label="Retourner la carte"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7c3aed]/10 text-[#7c3aed] active:scale-95"
            >
              <RotateCw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {monthClearConfirm ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="min-w-0 text-xs font-semibold text-rose-900">Réinitialiser tout le mois pour {serviceMeta(availabilityTab).label} ?</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={quickActionSaving !== null}
                onClick={() => {
                  setMonthClearConfirm(false);
                  void applyQuickAction("clear-month");
                }}
                className="inline-flex h-8 items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white disabled:opacity-60"
              >
                {quickActionSaving === "clear-month" ? "…" : "Confirmer"}
              </button>
              <button
                type="button"
                onClick={() => setMonthClearConfirm(false)}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : null}

        {/* Service selector (colour-coded per service) */}
        <div className="grid grid-cols-3 gap-2">
          {svcTabs.map((svc) => {
            const active = availabilityTab === svc;
            return (
              <button
                key={svc}
                type="button"
                onClick={() => setAvailabilityTab(svc)}
                className={
                  "flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold transition " +
                  (active ? serviceSolidTone(svc) : "border border-slate-200 bg-white text-slate-600")
                }
              >
                <ServiceIcon svc={svc} className="h-4 w-4 shrink-0" />
                <span className="truncate">{serviceMeta(svc).label}</span>
              </button>
            );
          })}
        </div>

        {/* Compact tariff for the active service */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
          <span className="text-sm font-semibold text-slate-900">Tarif</span>
          <input
            inputMode="numeric"
            value={priceInput}
            onChange={(e) => {
              const val = e.target.value;
              setPricingInputByService((prev) => ({ ...prev, [availabilityTab]: val }));
              clearTimeout(pricingDebounceRef.current[availabilityTab]);
              pricingDebounceRef.current[availabilityTab] = setTimeout(() => {
                void saveServicePricing(availabilityTab, val);
              }, 500);
            }}
            onBlur={() => void saveServicePricing(availabilityTab)}
            className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15"
          />
          <span className="text-xs font-medium text-slate-500">{pricingUnitLabel(availabilityTab)}</span>
          {pricingSavingByService[availabilityTab] ? <span className="ml-auto text-xs text-slate-400">Enregistrement…</span> : null}
        </div>

        {/* Flip card: month calendar ⇄ recurring weekly availability */}
        <div className="[perspective:1200px]">
          <div
            className={
              "relative h-[352px] w-full [transform-style:preserve-3d] transition-transform duration-500 " +
              (availFlipped ? "[transform:rotateY(180deg)]" : "")
            }
          >
            {/* FRONT — month calendar overview */}
            <div className="absolute inset-0 overflow-y-auto [backface-visibility:hidden]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold capitalize text-slate-900">{meta.monthLabel}</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMonthCursor((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1, 12, 0, 0, 0)))}
                    aria-label="Mois précédent"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 active:scale-95"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthCursor((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12, 0, 0, 0)))}
                    aria-label="Mois suivant"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 active:scale-95"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">
                <div>L</div>
                <div>M</div>
                <div>M</div>
                <div>J</div>
                <div>V</div>
                <div>S</div>
                <div>D</div>
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: meta.mondayIndex }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {Array.from({ length: meta.daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateIso = `${String(meta.year).padStart(4, "0")}-${String(meta.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const row = monthStatusByDate.get(dateIso);
                  const isPast = dateIso < todayKeyZurich;
                  const isToday = dateIso === todayKeyZurich;
                  // Only surface the service the sitter is currently editing.
                  const svcStatus = dayStatusForService(row, availabilityTab);
                  return (
                    <button
                      key={dateIso}
                      type="button"
                      disabled={isPast}
                      onClick={() => openInlineException(dateIso)}
                      aria-label={`Modifier les disponibilités du ${formatDateFrCh(dateIso)}`}
                      className={
                        "flex h-10 flex-col items-center justify-center gap-1 rounded-xl " +
                        (isPast ? "cursor-not-allowed opacity-30 " : "active:bg-slate-100 ") +
                        (isToday ? "bg-[#7c3aed]/10" : "")
                      }
                    >
                      <span className={"text-sm font-semibold leading-none " + (isToday ? "text-[#7c3aed]" : "text-slate-900")}>{day}</span>
                      <span className="flex h-1.5 items-center justify-center">
                        {svcStatus === "AVAILABLE" ? (
                          <span className={`h-1.5 w-1.5 rounded-full ${serviceDotTone(availabilityTab)}`} aria-hidden="true" />
                        ) : svcStatus === "ON_REQUEST" ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-center gap-3 text-[10px] font-medium text-slate-500">
                <span className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${serviceDotTone(availabilityTab)}`} aria-hidden="true" />Disponible</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />Sur demande</span>
              </div>
            </div>

            {/* BACK — recurring weekly availability */}
            <div className="absolute inset-0 overflow-y-auto [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <p className="text-sm font-semibold text-slate-900">Disponibilités récurrentes</p>
              <div className="mt-2 grid gap-1.5">
                {weeklyDayOptions.map((day) => {
                  const rule = weeklyRulesForTab.get(day.dayOfWeek) ?? { enabled: false, status: "AVAILABLE" as const };
                  return (
                    <div key={`${availabilityTab}-${day.dayOfWeek}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <label className="flex min-w-0 items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          disabled={anyRuleSaving || !canEditAvailabilityForTab}
                          onChange={(e) => void saveWeeklyRule(availabilityTab, day.dayOfWeek, e.currentTarget.checked, rule.status)}
                          className="h-4 w-4 rounded border-slate-300 text-[#7c3aed] focus:ring-[#7c3aed]"
                        />
                        <span className="text-sm font-medium text-slate-900">{day.label}</span>
                      </label>
                      <select
                        value={rule.status}
                        disabled={!rule.enabled || anyRuleSaving || !canEditAvailabilityForTab}
                        onChange={(e) => void saveWeeklyRule(availabilityTab, day.dayOfWeek, true, e.currentTarget.value === "ON_REQUEST" ? "ON_REQUEST" : "AVAILABLE")}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="AVAILABLE">Disponible</option>
                        <option value="ON_REQUEST">Sur demande</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Compact day-availability popup — portalled to <body> so it floats
            cleanly ABOVE the tab bar instead of colliding with the paw. */}
        {inlineExceptionOpen && exceptionDate
          ? createPortal(
              <>
                <div
                  className="fixed inset-0 z-[1400] bg-slate-900/40"
                  onClick={() => setInlineExceptionOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="fixed inset-x-3 z-[1401] max-h-[70vh] overflow-y-auto rounded-3xl bg-white p-4 shadow-[0_20px_60px_rgba(2,6,23,0.30)]"
                  style={{ bottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 20px)" }}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Disponibilité</p>
                      <p className="truncate text-base font-bold text-slate-900">{formatDateFrCh(exceptionDate)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInlineExceptionOpen(false)}
                      aria-label="Fermer"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-95"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  {enabledServices.length ? (
                    <div className="mt-3 flex gap-2">
                      {enabledServices.map((svc) => {
                        const active = exceptionService === svc;
                        return (
                          <button
                            key={`popup-svc-${svc}`}
                            type="button"
                            onClick={() => selectInlineExceptionService(svc)}
                            className={
                              "flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition " +
                              (active ? serviceSolidTone(svc) : "border border-slate-200 bg-white text-slate-600")
                            }
                          >
                            <ServiceIcon svc={svc} className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{serviceMeta(svc).label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(["AVAILABLE", "ON_REQUEST", "UNAVAILABLE"] as const).map((status) => {
                      const active = exceptionStatus === status;
                      const activeTone =
                        status === "AVAILABLE" ? "bg-[#7c3aed] text-white" : status === "ON_REQUEST" ? "bg-amber-500 text-white" : "bg-slate-600 text-white";
                      return (
                        <button
                          key={`popup-status-${status}`}
                          type="button"
                          onClick={() => setExceptionStatus(status)}
                          aria-pressed={active}
                          className={
                            "rounded-xl px-2 py-2.5 text-xs font-semibold transition " +
                            (active ? activeTone : "border border-slate-200 bg-white text-slate-600")
                          }
                        >
                          {statusLabelFr(status)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Time slots — appears when the service supports hours and the
                      day isn't marked unavailable. Native <select> keeps it discreet. */}
                  {serviceSupportsTimeSlots(exceptionService) && exceptionStatus !== "UNAVAILABLE" ? (
                    <div className="mt-3">
                      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-200">
                        <button
                          type="button"
                          onClick={() => setExceptionAllDay(true)}
                          className={
                            "rounded-xl px-2 py-2 text-xs font-semibold transition " +
                            (exceptionAllDay ? "bg-[#7c3aed] text-white" : "bg-white text-slate-600")
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
                            "rounded-xl px-2 py-2 text-xs font-semibold transition " +
                            (!exceptionAllDay ? "bg-[#7c3aed] text-white" : "bg-white text-slate-600")
                          }
                          aria-pressed={!exceptionAllDay}
                        >
                          Horaires
                        </button>
                      </div>

                      {!exceptionAllDay ? (
                        <div className="mt-2 space-y-2">
                          {exceptionRanges.map((r, idx) => (
                            <div key={`popup-range-${idx}`} className="flex items-center gap-2">
                              <select
                                value={r.startMin}
                                onChange={(e) =>
                                  setExceptionRanges((prev) => {
                                    const next = prev.slice();
                                    next[idx] = { ...next[idx], startMin: Number(e.target.value) };
                                    return next;
                                  })
                                }
                                className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900"
                                aria-label={`Créneau ${idx + 1} début`}
                              >
                                {TIME_PICKER_OPTIONS.map((m) => (
                                  <option key={`s-${idx}-${m}`} value={m}>
                                    {minutesToHHMM(m)}
                                  </option>
                                ))}
                              </select>
                              <span className="text-xs font-semibold text-slate-400" aria-hidden="true">→</span>
                              <select
                                value={r.endMin}
                                onChange={(e) =>
                                  setExceptionRanges((prev) => {
                                    const next = prev.slice();
                                    next[idx] = { ...next[idx], endMin: Number(e.target.value) };
                                    return next;
                                  })
                                }
                                className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900"
                                aria-label={`Créneau ${idx + 1} fin`}
                              >
                                {TIME_PICKER_OPTIONS.map((m) => (
                                  <option key={`e-${idx}-${m}`} value={m}>
                                    {minutesToHHMM(m)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setExceptionRanges((prev) => prev.filter((_, j) => j !== idx))}
                                aria-label="Supprimer ce créneau"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 active:scale-95"
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setExceptionRanges((prev) => [...prev, { startMin: 8 * 60, endMin: 10 * 60 }])}
                            className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#7c3aed] active:bg-slate-50"
                          >
                            + Ajouter un créneau
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {exceptionError ? <p className="mt-3 text-xs font-semibold text-rose-600">{exceptionError}</p> : null}

                  <button
                    type="button"
                    disabled={exceptionSaving || !enabledServices.length}
                    onClick={() => void saveSingleDayException(exceptionService, exceptionDate, exceptionStatus)}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#7c3aed] px-4 py-3 text-sm font-semibold text-white active:bg-[#6d28d9] disabled:opacity-50"
                  >
                    {exceptionSaving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </>,
              document.body,
            )
          : null}
      </div>
    );
  }

  const activeServiceEnabled = configByService[availabilityTab]?.enabled ?? true;
  const activeServiceHasRules = (rulesByService[availabilityTab]?.length ?? 0) > 0;
  const showAvailabilityNudge = initialLoaded && activeServiceEnabled && !activeServiceHasRules;
  const activeServiceLabel =
    availabilityTab === "PROMENADE" ? "la promenade" : availabilityTab === "DOGSITTING" ? "la garde" : "la pension";

  return (
    <div className="w-full py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-bold text-slate-900 sm:text-2xl">Disponibilités</p>
          <p className="ds-native-hide mt-1 text-sm text-slate-600 sm:mt-2">Configure tes services et tes exceptions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedPing ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
              🟢 {savedPing}
            </span>
          ) : null}
        </div>
      </div>

      {showAvailabilityNudge ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Aucune disponibilité pour {activeServiceLabel}</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Tant que ton agenda est vide, tu restes <b>invisible</b> pour les clients sur ce service. Clique sur les jours de la semaine où tu es disponible ci-dessous — ou utilise « Rendre tout le mois disponible ».
          </p>
        </div>
      ) : null}

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
                            setExceptionError(errorMessageFr(err instanceof Error ? err.message : "DELETE_ERROR"));
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
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-base"
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
                                  ? "flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-sky-50 px-3 py-2 transition-colors"
                                  : "flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 transition-colors"
                              }
                            >
                              <div className="flex items-center gap-2">
                                <div className="relative" ref={activeTimePicker?.idx === idx && activeTimePicker.field === "startMin" ? activeTimePickerRef : null}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveTimePicker((prev) =>
                                        prev?.idx === idx && prev.field === "startMin" ? null : { idx, field: "startMin" }
                                      )
                                    }
                                    className={
                                      activeTimePicker?.idx === idx && activeTimePicker.field === "startMin"
                                        ? "inline-flex h-10 w-[104px] items-center justify-between rounded-2xl border border-[var(--dogshift-blue)] bg-white px-3 text-sm font-semibold text-slate-900 ring-2 ring-[color:rgba(58,124,245,0.15)]"
                                        : "inline-flex h-10 w-[104px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
                                    }
                                    aria-haspopup="listbox"
                                    aria-expanded={activeTimePicker?.idx === idx && activeTimePicker.field === "startMin"}
                                    aria-label={`Plage ${idx + 1} début`}
                                  >
                                    <span>{minutesToHHMM(r.startMin)}</span>
                                    <span className="text-xs text-slate-400">▾</span>
                                  </button>

                                  {activeTimePicker?.idx === idx && activeTimePicker.field === "startMin" ? (
                                    <div className="absolute left-0 top-full z-20 mt-2 max-h-56 w-[124px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                      <div className="grid gap-1">
                                        {TIME_PICKER_OPTIONS.map((optionMin) => {
                                          const selected = optionMin === r.startMin;
                                          return (
                                            <button
                                              key={`drawer-start-${idx}-${optionMin}`}
                                              type="button"
                                              onClick={() => {
                                                setExceptionRanges((prev) => {
                                                  const next = prev.slice();
                                                  next[idx] = { ...next[idx], startMin: optionMin };
                                                  return next;
                                                });
                                                setActiveTimePicker(null);
                                              }}
                                              className={
                                                selected
                                                  ? "rounded-xl bg-[var(--dogshift-blue)] px-3 py-2 text-left text-sm font-semibold text-white"
                                                  : "rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                              }
                                            >
                                              {minutesToHHMM(optionMin)}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                                <span className="text-xs font-semibold text-slate-400" aria-hidden="true">
                                  →
                                </span>
                                <div className="relative" ref={activeTimePicker?.idx === idx && activeTimePicker.field === "endMin" ? activeTimePickerRef : null}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveTimePicker((prev) =>
                                        prev?.idx === idx && prev.field === "endMin" ? null : { idx, field: "endMin" }
                                      )
                                    }
                                    className={
                                      activeTimePicker?.idx === idx && activeTimePicker.field === "endMin"
                                        ? "inline-flex h-10 w-[104px] items-center justify-between rounded-2xl border border-[var(--dogshift-blue)] bg-white px-3 text-sm font-semibold text-slate-900 ring-2 ring-[color:rgba(58,124,245,0.15)]"
                                        : "inline-flex h-10 w-[104px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
                                    }
                                    aria-haspopup="listbox"
                                    aria-expanded={activeTimePicker?.idx === idx && activeTimePicker.field === "endMin"}
                                    aria-label={`Plage ${idx + 1} fin`}
                                  >
                                    <span>{minutesToHHMM(r.endMin)}</span>
                                    <span className="text-xs text-slate-400">▾</span>
                                  </button>

                                  {activeTimePicker?.idx === idx && activeTimePicker.field === "endMin" ? (
                                    <div className="absolute left-0 top-full z-20 mt-2 max-h-56 w-[124px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                      <div className="grid gap-1">
                                        {TIME_PICKER_OPTIONS.map((optionMin) => {
                                          const selected = optionMin === r.endMin;
                                          return (
                                            <button
                                              key={`drawer-end-${idx}-${optionMin}`}
                                              type="button"
                                              onClick={() => {
                                                setExceptionRanges((prev) => {
                                                  const next = prev.slice();
                                                  next[idx] = { ...next[idx], endMin: optionMin };
                                                  return next;
                                                });
                                                setActiveTimePicker(null);
                                              }}
                                              className={
                                                selected
                                                  ? "rounded-xl bg-[var(--dogshift-blue)] px-3 py-2 text-left text-sm font-semibold text-white"
                                                  : "rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                              }
                                            >
                                              {minutesToHHMM(optionMin)}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTimePicker((prev) => (prev?.idx === idx ? null : prev));
                                  setExceptionRanges((prev) => {
                                    const next = prev.slice();
                                    next.splice(idx, 1);
                                    return next;
                                  });
                                }}
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
                    setExceptionError(errorMessageFr(err instanceof Error ? err.message : "SAVE_ERROR"));
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Column 1: Services and Disponibilités */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Services Card — NO 3D transforms (causes Safari viewport expansion) */}
          {bookingInfoOpen ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm sm:rounded-3xl sm:p-5">
              <div className="flex items-center justify-between mb-5 border-b border-slate-200/60 pb-3 shrink-0">
                <p className="text-sm font-bold text-slate-900 flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--dogshift-blue)]/10 text-[var(--dogshift-blue)]">
                    <Info className="h-3.5 w-3.5" />
                  </span>
                  Fonctionnement
                </p>
                <button
                  type="button"
                  onClick={() => setBookingInfoOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 transition-all hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 active:scale-95 shadow-sm"
                  title="Fermer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid gap-4 pb-2">
                {[
                  { icon: <Settings className="h-4 w-4" />, title: "Configuration", desc: "Tarifs requis avant d'activer un service." },
                  { icon: <Banknote className="h-4 w-4" />, title: "Tarification", desc: "Promenade/garde (CHF/h), Pension (CHF/jour)." },
                  { icon: <Clock className="h-4 w-4" />, title: "Horaires", desc: "Créneaux de 30 min. Réservation 24h à l'avance." },
                  { icon: <ShieldCheck className="h-4 w-4" />, title: "Marge de sécurité", desc: "30 min bloquées avant/après chaque réservation." },
                  { icon: <Home className="h-4 w-4" />, title: "Pension", desc: "Arrivée/départ selon tes disponibilités." },
                  { icon: <Rocket className="h-4 w-4" />, title: "Phase pilote", desc: "Tarifs encadrés pour garantir la qualité." },
                ].map((item, i) => (
                  <div key={`info-${i}`} className="flex gap-3 items-start">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm text-slate-500">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-slate-600 leading-relaxed text-[12px]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 relative sm:rounded-3xl sm:p-5">
              <button
                type="button"
                onClick={() => setBookingInfoOpen(true)}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 z-10 sm:right-5 sm:top-5"
                title="Fonctionnement des réservations"
              >
                <Info className="h-4 w-4" />
              </button>
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm font-semibold text-slate-900">Services</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500 pr-10">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${serviceDotTone("PROMENADE")}`} aria-hidden="true" />
                    <span>Promenade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${serviceDotTone("DOGSITTING")}`} aria-hidden="true" />
                    <span>Dogsitting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${serviceDotTone("PENSION")}`} aria-hidden="true" />
                    <span>Pension</span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-1.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setServicesCarouselIndex((prev) => Math.max(0, prev - 1))}
                    disabled={servicesCarouselIndex === 0}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-700 disabled:cursor-default disabled:opacity-35 sm:h-10 sm:w-10 sm:rounded-2xl sm:text-lg"
                    aria-label="Service précédent"
                  >
                    ←
                  </button>

                  <div className="min-w-0 flex-1 pt-2">
                    <div className="w-full overflow-hidden rounded-[2rem]">
                      <div
                        className="flex w-full transition-transform duration-300 ease-out"
                        style={{ transform: `translateX(-${servicesCarouselIndex * 100}%)` }}
                      >
                        {(["PROMENADE", "DOGSITTING", "PENSION"] as const).map((svc) => {
                          const metaSvc = serviceMeta(svc);
                          const cfg = configByService[svc];
                          const enabled = cfg?.enabled === true;
                          const tone = serviceDotTone(svc);
                          const activeSwitchTone = tone === "bg-sky-400" ? "bg-sky-500" : tone === "bg-violet-400" ? "bg-violet-500" : "bg-emerald-500";
                          const priceInput = pricingInputByService[svc] ?? "";
                          const priceError = pricingErrorByService[svc];
                          const priceSaving = pricingSavingByService[svc];
                          const isActiveCard = availabilityTab === svc;
                          return (
                            <div key={svc} className="w-full min-w-full flex-none">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setAvailabilityTab(svc)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setAvailabilityTab(svc);
                                  }
                                }}
                                className={
                                  isActiveCard
                                    ? "m-1 cursor-pointer rounded-2xl border-2 border-[var(--dogshift-blue)] bg-white p-3 text-left shadow-sm sm:m-2 sm:rounded-3xl sm:p-4"
                                    : "m-1 cursor-pointer rounded-2xl border-2 border-transparent ring-1 ring-inset ring-slate-200 bg-white p-3 text-left sm:m-2 sm:rounded-3xl sm:p-4"
                                }
                                aria-pressed={isActiveCard}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-left min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">
                                      {metaSvc.icon} {metaSvc.label}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                      {isActiveCard ? "En configuration" : "Configurer"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={enabled}
                                    disabled={!enabled ? Boolean(priceError) : false}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void saveServiceEnabled(svc, !enabled);
                                    }}
                                    className={
                                      enabled
                                        ? `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full ${activeSwitchTone} transition`
                                        : "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-slate-300 transition disabled:opacity-50"
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
                                {cfg ? null : <div className="mt-3 h-4 w-full max-w-[10rem] animate-pulse rounded bg-slate-100" />}

                                <div className="mt-3 grid gap-2">
                                  <label className="text-xs font-semibold text-slate-500">Tarif</label>
                                  <div className="flex items-center gap-2 pr-1">
                                    <input
                                      value={priceInput}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const val = e.target.value;
                                        setPricingInputByService((prev) => ({ ...prev, [svc]: val }));
                                        clearTimeout(pricingDebounceRef.current[svc]);
                                        pricingDebounceRef.current[svc] = setTimeout(() => {
                                          void saveServicePricing(svc, val);
                                        }, 500);
                                      }}
                                      onBlur={(e) => {
                                        clearTimeout(pricingDebounceRef.current[svc]);
                                        void saveServicePricing(svc, e.target.value);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      inputMode="decimal"
                                      placeholder={pricingPlaceholderLabel(svc)}
                                      className="h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-900"
                                    />
                                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">{pricingUnitLabel(svc)}</span>
                                    {priceSaving ? <span className="text-xs font-semibold text-slate-400 shrink-0">...</span> : null}
                                  </div>
                                  <p className="text-[11px] font-semibold text-slate-500">Fourchette : {pricingRangeLabel(svc)}</p>
                                  {priceError ? <p className="text-xs font-medium text-rose-600">{priceError}</p> : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setServicesCarouselIndex((prev) => Math.min(2, prev + 1))}
                    disabled={servicesCarouselIndex === 2}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-700 disabled:cursor-default disabled:opacity-35 sm:h-10 sm:w-10 sm:rounded-2xl sm:text-lg"
                    aria-label="Service suivant"
                  >
                    →
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  {(["PROMENADE", "DOGSITTING", "PENSION"] as const).map((svc, idx) => {
                    const active = servicesCarouselIndex === idx;
                    return <span key={`service-dot-${svc}`} className={active ? "h-2 w-2 rounded-full bg-slate-900" : "h-2 w-2 rounded-full bg-slate-300"} aria-hidden="true" />;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Disponibilités Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:rounded-3xl sm:p-5">
            <p className="text-sm font-semibold text-slate-900">Disponibilités</p>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1.5 ring-1 ring-slate-200 sm:gap-2 sm:p-2">
              {(["PROMENADE", "DOGSITTING", "PENSION"] as const).map((svc) => {
                const active = availabilityTab === svc;
                const tone = serviceDotTone(svc);
                const baseTone = tone === "bg-sky-400" ? "bg-sky-500" : tone === "bg-violet-400" ? "bg-violet-500" : "bg-emerald-500";
                const disabled = configByService[svc]?.enabled !== true || Boolean(pricingErrorByService[svc]);
                return (
                  <button
                    key={`tab-${svc}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => setAvailabilityTab(svc)}
                    className={
                      active
                        ? `rounded-2xl ${baseTone} px-2 py-1.5 text-[11px] font-semibold text-white sm:px-3 sm:py-2 sm:text-xs`
                        : "rounded-2xl bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 sm:px-3 sm:py-2 sm:text-xs"
                    }
                    aria-pressed={active}
                  >
                    {serviceMeta(svc).label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              {!canEditAvailabilityForTab ? (
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-900">
                    {configByService[availabilityTab]?.enabled !== true
                      ? "Active d’abord ce service pour modifier ses disponibilités."
                      : pricingErrorByService[availabilityTab] ?? "Ajoute un tarif valide pour modifier les disponibilités."}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {serviceMeta(availabilityTab).icon} {serviceMeta(availabilityTab).label}
                  </p>
                  <span className={`h-2 w-2 rounded-full ${serviceDotTone(availabilityTab)}`} aria-hidden="true" />
                </div>
                <div ref={quickActionsWrapRef} className="relative">
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

                  {quickActionsOpen ? (
                    <div id="availability-quick-actions" className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[80vw] rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-xl">
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
                  ) : null}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-900">Disponibilités hebdomadaires</p>
                  <p className="mt-1 text-xs text-slate-600">Définis ici tes disponibilités récurrentes pour des journées entières.</p>
                </div>
                {(() => {
                  if (!configByService[availabilityTab]) return <p className="text-sm text-slate-600">Chargement…</p>;
                  return (
                    <div className="grid gap-1.5">
                      {weeklyDayOptions.map((day) => {
                        const rule = weeklyRulesForTab.get(day.dayOfWeek) ?? { enabled: false, status: "AVAILABLE" as const };
                        const isSaving = weeklySavingKey === `${availabilityTab}-${day.dayOfWeek}`;
                        return (
                          <div key={`${availabilityTab}-${day.dayOfWeek}`} className="flex items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
                            <label className="flex min-w-0 items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={rule.enabled}
                                disabled={anyRuleSaving || !canEditAvailabilityForTab}
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
                                disabled={!rule.enabled || anyRuleSaving || !canEditAvailabilityForTab}
                                onChange={(e) => {
                                  const nextStatus = e.currentTarget.value === "ON_REQUEST" ? "ON_REQUEST" : "AVAILABLE";
                                  void saveWeeklyRule(availabilityTab, day.dayOfWeek, true, nextStatus);
                                }}
                                className="h-8 max-w-[110px] rounded-lg border border-slate-200 bg-white px-1.5 text-base font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:max-w-none sm:px-2.5"
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
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:rounded-3xl sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Agenda des disponibilités</p>
            </div>
            <div className="flex items-center gap-2">
              {resetConfirmOpen ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-700">Tout effacer ?</span>
                  <button
                    type="button"
                    onClick={() => void resetAllAvailability()}
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetConfirmOpen(false)}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setResetConfirmOpen(true)}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700"
                >
                  Réinitialiser
                </button>
              )}
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

            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 sm:gap-2">
              <div>L</div>
              <div>M</div>
              <div>M</div>
              <div>J</div>
              <div>V</div>
              <div>S</div>
              <div>D</div>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: meta.mondayIndex }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {Array.from({ length: meta.daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateIso = `${String(meta.year).padStart(4, "0")}-${String(meta.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const row = monthStatusByDate.get(dateIso);
                const status = globalDayStatus(row);
                const tone = statusCellTone(status);
                const isPast = dateIso < todayKeyZurich;
                const showPromenade = row ? row.promenadeStatus === "AVAILABLE" || row.promenadeStatus === "ON_REQUEST" : false;
                const showDogsitting = row ? row.dogsittingStatus === "AVAILABLE" || row.dogsittingStatus === "ON_REQUEST" : false;
                const showPension = row ? row.pensionStatus === "AVAILABLE" || row.pensionStatus === "ON_REQUEST" : false;

                return (
                  <button
                    key={dateIso}
                    type="button"
                    disabled={isPast}
                    onClick={() => {
                      if (isPast) return;
                      openInlineException(dateIso);
                    }}
                    className={
                      isPast
                        ? `flex h-10 w-full flex-col justify-between rounded-xl ring-1 ${tone} cursor-not-allowed px-1 py-0.5 opacity-40 sm:h-12 sm:rounded-2xl sm:px-2 sm:py-1`
                        : `flex h-10 w-full flex-col justify-between rounded-xl ring-1 ${tone} px-1 py-0.5 hover:ring-2 sm:h-12 sm:rounded-2xl sm:px-2 sm:py-1`
                    }
                    aria-label={`Disponibilité ${formatDateFrCh(dateIso)}`}
                  >
                    <div className="flex items-start justify-end">
                      <span className="text-sm font-semibold leading-none text-slate-900">{day}</span>
                    </div>

                    <div className="flex items-center justify-center gap-1">
                      {showPromenade ? <span className={`h-2 w-2 rounded-full ${serviceDotTone("PROMENADE")}`} aria-hidden="true" /> : null}
                      {showDogsitting ? <span className={`h-2 w-2 rounded-full ${serviceDotTone("DOGSITTING")}`} aria-hidden="true" /> : null}
                      {showPension ? <span className={`h-2 w-2 rounded-full ${serviceDotTone("PENSION")}`} aria-hidden="true" /> : null}
                      {!showPromenade && !showDogsitting && !showPension ? (
                        <span className="text-[10px] font-semibold leading-none text-slate-400">—</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Accepter les réservations de dernière minute</p>
                <p className="mt-1 text-xs text-slate-600">
                  Permet aux propriétaires de réserver à moins de 24h. Ces réservations sont confirmées immédiatement après paiement.
                </p>
                {lastMinutePhonePresent === false ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Ajoutez un numéro de téléphone dans les paramètres pour activer cette option.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={lastMinuteEnabledGlobal === true}
                disabled={lastMinuteEnabledGlobal === null || lastMinuteSavingGlobal || lastMinutePhonePresent === false}
                onClick={() => {
                  if (lastMinuteEnabledGlobal === null) return;
                  void saveLastMinuteGlobal(!lastMinuteEnabledGlobal);
                }}
                className={
                  lastMinuteEnabledGlobal === true
                    ? "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-slate-900 transition disabled:opacity-50"
                    : "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-slate-300 transition disabled:opacity-50"
                }
                aria-label={
                  lastMinuteEnabledGlobal === true
                    ? "Désactiver les réservations de dernière minute"
                    : "Activer les réservations de dernière minute"
                }
              >
                <span
                  className={
                    lastMinuteEnabledGlobal === true
                      ? "inline-block h-5 w-5 translate-x-5 rounded-full bg-white shadow transition"
                      : "inline-block h-5 w-5 translate-x-1 rounded-full bg-white shadow transition"
                  }
                />
              </button>
            </div>
          </div>

          {inlineExceptionOpen && exceptionDate ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
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

              <label className="mt-3 block text-xs font-semibold text-slate-700">
                Service
                <select
                  value={exceptionService}
                  onChange={(e) => {
                    const svc = e.target.value as ServiceTypeApi;
                    if (svc === "PROMENADE" || svc === "DOGSITTING" || svc === "PENSION") selectInlineExceptionService(svc);
                  }}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-base text-slate-900"
                >
                  {(["PROMENADE", "DOGSITTING", "PENSION"] as const).map((svc) => {
                    const disabled = isServiceSelectionDisabled(svc, configByService, pricingErrorByService);
                    return (
                      <option key={`inline-service-${svc}`} value={svc} disabled={disabled}>
                        {serviceMeta(svc).label}
                      </option>
                    );
                  })}
                </select>
              </label>

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
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
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
                                  ? "flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-sky-50 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2"
                                  : "flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2"
                              }
                            >
                              <div className="flex items-center gap-2">
                                <div className="relative" ref={activeTimePicker?.idx === idx && activeTimePicker.field === "startMin" ? activeTimePickerRef : null}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveTimePicker((prev) =>
                                        prev?.idx === idx && prev.field === "startMin" ? null : { idx, field: "startMin" }
                                      )
                                    }
                                    className={
                                      activeTimePicker?.idx === idx && activeTimePicker.field === "startMin"
                                        ? "inline-flex h-9 w-[76px] items-center justify-between rounded-xl border border-[var(--dogshift-blue)] bg-white px-2 text-xs font-semibold text-slate-900 ring-2 ring-[color:rgba(58,124,245,0.15)] sm:h-10 sm:w-[104px] sm:rounded-2xl sm:px-3 sm:text-sm"
                                        : "inline-flex h-9 w-[76px] items-center justify-between rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-900 sm:h-10 sm:w-[104px] sm:rounded-2xl sm:px-3 sm:text-sm"
                                    }
                                    aria-haspopup="listbox"
                                    aria-expanded={activeTimePicker?.idx === idx && activeTimePicker.field === "startMin"}
                                    aria-label={`Créneau ${idx + 1} début`}
                                  >
                                    <span>{minutesToHHMM(range.startMin)}</span>
                                    <span className="text-xs text-slate-400">▾</span>
                                  </button>

                                  {activeTimePicker?.idx === idx && activeTimePicker.field === "startMin" ? (
                                    <div className="absolute left-0 top-full z-20 mt-2 max-h-56 w-[124px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                      <div className="grid gap-1">
                                        {TIME_PICKER_OPTIONS.map((optionMin) => {
                                          const selected = optionMin === range.startMin;
                                          return (
                                            <button
                                              key={`start-${idx}-${optionMin}`}
                                              type="button"
                                              onClick={() => {
                                                setExceptionRanges((prev) => {
                                                  const next = prev.slice();
                                                  next[idx] = { ...next[idx], startMin: optionMin };
                                                  return next;
                                                });
                                                setActiveTimePicker(null);
                                              }}
                                              className={
                                                selected
                                                  ? "rounded-xl bg-[var(--dogshift-blue)] px-3 py-2 text-left text-sm font-semibold text-white"
                                                  : "rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                              }
                                            >
                                              {minutesToHHMM(optionMin)}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                                <span className="text-xs font-semibold text-slate-400">→</span>
                                <div className="relative" ref={activeTimePicker?.idx === idx && activeTimePicker.field === "endMin" ? activeTimePickerRef : null}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveTimePicker((prev) =>
                                        prev?.idx === idx && prev.field === "endMin" ? null : { idx, field: "endMin" }
                                      )
                                    }
                                    className={
                                      activeTimePicker?.idx === idx && activeTimePicker.field === "endMin"
                                        ? "inline-flex h-9 w-[76px] items-center justify-between rounded-xl border border-[var(--dogshift-blue)] bg-white px-2 text-xs font-semibold text-slate-900 ring-2 ring-[color:rgba(58,124,245,0.15)] sm:h-10 sm:w-[104px] sm:rounded-2xl sm:px-3 sm:text-sm"
                                        : "inline-flex h-9 w-[76px] items-center justify-between rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-900 sm:h-10 sm:w-[104px] sm:rounded-2xl sm:px-3 sm:text-sm"
                                    }
                                    aria-haspopup="listbox"
                                    aria-expanded={activeTimePicker?.idx === idx && activeTimePicker.field === "endMin"}
                                    aria-label={`Créneau ${idx + 1} fin`}
                                  >
                                    <span>{minutesToHHMM(range.endMin)}</span>
                                    <span className="text-xs text-slate-400">▾</span>
                                  </button>

                                  {activeTimePicker?.idx === idx && activeTimePicker.field === "endMin" ? (
                                    <div className="absolute left-0 top-full z-20 mt-2 max-h-56 w-[124px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                      <div className="grid gap-1">
                                        {TIME_PICKER_OPTIONS.map((optionMin) => {
                                          const selected = optionMin === range.endMin;
                                          return (
                                            <button
                                              key={`end-${idx}-${optionMin}`}
                                              type="button"
                                              onClick={() => {
                                                setExceptionRanges((prev) => {
                                                  const next = prev.slice();
                                                  next[idx] = { ...next[idx], endMin: optionMin };
                                                  return next;
                                                });
                                                setActiveTimePicker(null);
                                              }}
                                              className={
                                                selected
                                                  ? "rounded-xl bg-[var(--dogshift-blue)] px-3 py-2 text-left text-sm font-semibold text-white"
                                                  : "rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                              }
                                            >
                                              {minutesToHHMM(optionMin)}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTimePicker((prev) => (prev?.idx === idx ? null : prev));
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
                          setActiveTimePicker(null);
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
