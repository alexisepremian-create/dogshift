import { SERVICE_DEFAULTS, computeDaySlots, dayOfWeekForZurichDate, TIMEZONE_ZURICH, type ServiceType } from "./slotEngine.ts";
import { summarizeDayStatusFromSlots } from "./dayStatus.ts";

export type MultiServiceDayStatus = {
  date: string;
  promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
  dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
  pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
  promenadePartial: boolean;
  dogsittingPartial: boolean;
  pensionPartial: boolean;
};

export type DayStatusMultiInput = {
  sitterId: string;
  dates: string[];
  now: Date;
  allRules: any[];
  allExceptions: any[];
  allBookings: any[];
  allConfigs: any[];
};

function ensureServiceConfig(sitterId: string, serviceType: ServiceType, row: any) {
  const defaults = SERVICE_DEFAULTS[serviceType];
  const enabled = typeof row?.enabled === "boolean" ? row.enabled : undefined;
  return {
    ...defaults,
    sitterId,
    ...(enabled !== undefined ? { enabled } : null),
    serviceType,
  };
}

function ensureServiceConfigForPublicCalendar(sitterId: string, serviceType: ServiceType, row: any) {
  // For the public calendar, never assume a service is enabled unless there is an explicit DB row.
  if (!row) {
    return {
      ...SERVICE_DEFAULTS[serviceType],
      sitterId,
      enabled: false,
      serviceType,
    };
  }
  return ensureServiceConfig(sitterId, serviceType, row);
}

function toZurichIsoDate(dt: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_ZURICH,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function exceptionDateKey(ex: any) {
  const v = ex?.date;
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return toZurichIsoDate(v);
  return "";
}

function bookingStartDate(b: any) {
  const v = b?.startAt ?? b?.startDate;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const dt = new Date(v);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function isBookingConflictReason(reason: unknown) {
  return (
    reason === "booking_existing_overlap" ||
    reason === "booking_paid_overlap" ||
    reason === "booking_confirmed_overlap" ||
    reason === "booking_pending_payment_overlap" ||
    reason === "booking_pending_acceptance_overlap"
  );
}

function bookingEndDate(b: any) {
  const v = b?.endAt ?? b?.endDate;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const dt = new Date(v);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function isZurichMidnight(dt: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE_ZURICH,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(dt);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "NaN");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "NaN");
  const ss = Number(parts.find((p) => p.type === "second")?.value ?? "NaN");
  return hh === 0 && mm === 0 && ss === 0;
}

function addDaysIsoUtc(iso: string, deltaDays: number) {
  const dt = new Date(`${iso}T12:00:00Z`);
  const next = new Date(dt.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

function clampIso(iso: string, minIso: string, maxIso: string) {
  if (iso < minIso) return minIso;
  if (iso > maxIso) return maxIso;
  return iso;
}

function summarizeConfiguredStatus(rows: Array<{ status?: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE" }> | undefined) {
  const items = Array.isArray(rows) ? rows : [];
  let hasAvailable = false;
  let hasOnRequest = false;

  for (const row of items) {
    if (!row || typeof row.status !== "string") continue;
    if (row.status === "AVAILABLE") hasAvailable = true;
    if (row.status === "ON_REQUEST") hasOnRequest = true;
    if (row.status === "UNAVAILABLE") return "UNAVAILABLE" as const;
  }

  if (hasOnRequest) return "ON_REQUEST" as const;
  if (hasAvailable) return "AVAILABLE" as const;
  return null;
}

export function computeMultiDayStatusNaive(input: DayStatusMultiInput): MultiServiceDayStatus[] {
  const { sitterId, dates, now, allRules, allExceptions, allBookings, allConfigs } = input;

  const configByService = new Map<ServiceType, any>();
  for (const row of allConfigs ?? []) {
    const st = row?.serviceType as ServiceType;
    if (st === "PROMENADE" || st === "DOGSITTING" || st === "PENSION") {
      configByService.set(st, ensureServiceConfigForPublicCalendar(sitterId, st, row));
    }
  }

  return dates.map((date) => {
    const dow = dayOfWeekForZurichDate(date);

    const computeStatus = (serviceType: ServiceType) => {
      const rules = (allRules ?? []).filter((r: any) => r && r.serviceType === serviceType && r.dayOfWeek === dow);
      const exceptions = (allExceptions ?? []).filter((e: any) => e && e.serviceType === serviceType && exceptionDateKey(e) === date);
      const config = configByService.get(serviceType) ?? ensureServiceConfigForPublicCalendar(sitterId, serviceType, null);
      const slots = computeDaySlots({
        serviceType,
        date,
        now,
        rules,
        exceptions,
        bookings: allBookings ?? [],
        config,
      });
      return summarizeDayStatusFromSlots(slots);
    };

    return {
      date,
      promenadeStatus: computeStatus("PROMENADE"),
      dogsittingStatus: computeStatus("DOGSITTING"),
      pensionStatus: computeStatus("PENSION"),
      promenadePartial: false,
      dogsittingPartial: false,
      pensionPartial: false,
    };
  });
}

export function computeMultiDayStatusIndexed(input: DayStatusMultiInput): {
  days: MultiServiceDayStatus[];
  metrics: {
    rulesCount: number;
    exceptionsCount: number;
    bookingsCount: number;
    configsCount: number;
    bookingsPerDayMin: number;
    bookingsPerDayMax: number;
    bookingsPerDayAvg: number;
  };
} {
  const { sitterId, dates, now, allRules, allExceptions, allBookings, allConfigs } = input;

  const services: ServiceType[] = ["PROMENADE", "DOGSITTING", "PENSION"];

  const rulesByServiceByDow: Record<ServiceType, Record<number, any[]>> = {
    PROMENADE: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
    DOGSITTING: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
    PENSION: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
  };

  for (const r of allRules ?? []) {
    const st = r?.serviceType as ServiceType;
    const dow = typeof r?.dayOfWeek === "number" ? r.dayOfWeek : null;
    if ((st === "PROMENADE" || st === "DOGSITTING" || st === "PENSION") && dow !== null && dow >= 0 && dow <= 6) {
      rulesByServiceByDow[st][dow].push(r);
    }
  }

  const exceptionsByServiceByDate: Record<ServiceType, Map<string, any[]>> = {
    PROMENADE: new Map(),
    DOGSITTING: new Map(),
    PENSION: new Map(),
  };

  for (const e of allExceptions ?? []) {
    const st = e?.serviceType as ServiceType;
    if (!(st === "PROMENADE" || st === "DOGSITTING" || st === "PENSION")) continue;
    const key = exceptionDateKey(e);
    if (!key) continue;
    const bucket = exceptionsByServiceByDate[st].get(key) ?? [];
    bucket.push(e);
    exceptionsByServiceByDate[st].set(key, bucket);
  }

  const configByService: Record<ServiceType, any> = {
    PROMENADE: ensureServiceConfigForPublicCalendar(sitterId, "PROMENADE", null),
    DOGSITTING: ensureServiceConfigForPublicCalendar(sitterId, "DOGSITTING", null),
    PENSION: ensureServiceConfigForPublicCalendar(sitterId, "PENSION", null),
  };

  for (const row of allConfigs ?? []) {
    const st = row?.serviceType as ServiceType;
    if (st === "PROMENADE" || st === "DOGSITTING" || st === "PENSION") {
      configByService[st] = ensureServiceConfigForPublicCalendar(sitterId, st, row);
    }
  }

  const fromIso = dates[0] ?? "";
  const toIso = dates[dates.length - 1] ?? "";

  const bookingsByDate = new Map<string, any[]>();
  for (const d of dates) bookingsByDate.set(d, []);

  for (const b of allBookings ?? []) {
    const startAt = bookingStartDate(b);
    const endAt = bookingEndDate(b);
    if (!startAt || !endAt) continue;
    const startIso = toZurichIsoDate(startAt);
    const endIsoRaw = toZurichIsoDate(endAt);
    if (!startIso || !endIsoRaw) continue;

    // If a booking ends exactly at local midnight, it should NOT block that calendar day.
    // Example: [2026-03-10 18:00 → 2026-03-11 00:00) blocks 10th but not 11th.
    const endIso = isZurichMidnight(endAt) ? addDaysIsoUtc(endIsoRaw, -1) : endIsoRaw;
    if (endIso < startIso) continue;

    const minIso = clampIso(startIso, fromIso, toIso);
    const maxIso = clampIso(endIso, fromIso, toIso);
    if (maxIso < fromIso || minIso > toIso) continue;

    for (let d = minIso; d <= maxIso; d = addDaysIsoUtc(d, 1)) {
      const bucket = bookingsByDate.get(d);
      if (!bucket) continue;
      bucket.push(b);
    }
  }

  let min = Infinity;
  let max = 0;
  let sum = 0;
  for (const d of dates) {
    const n = bookingsByDate.get(d)?.length ?? 0;
    min = Math.min(min, n);
    max = Math.max(max, n);
    sum += n;
  }
  if (!Number.isFinite(min)) min = 0;

  const days: MultiServiceDayStatus[] = dates.map((date) => {
    const dow = dayOfWeekForZurichDate(date);
    const bookings = bookingsByDate.get(date) ?? [];

    const computeStatus = (serviceType: ServiceType) => {
      const rules = rulesByServiceByDow[serviceType][dow] ?? [];
      const exceptions = exceptionsByServiceByDate[serviceType].get(date) ?? [];
      const config = configByService[serviceType];

      if (config?.enabled === false) return { status: "UNAVAILABLE" as const, partial: false };

      const slots = computeDaySlots({
        serviceType,
        date,
        now,
        rules,
        exceptions,
        bookings,
        config,
      });
      const status = summarizeDayStatusFromSlots(slots);
      const hasBookableSlots = slots.some((slot) => slot.status === "AVAILABLE" || slot.status === "ON_REQUEST");
      const hasBookingBlockedSlots = slots.some((slot) => slot.status === "UNAVAILABLE" && isBookingConflictReason(slot.reason));
      const partial = hasBookableSlots && hasBookingBlockedSlots;
      return {
        status: partial && status === "UNAVAILABLE" ? ("AVAILABLE" as const) : status,
        partial,
      };
    };

    const promenade = computeStatus("PROMENADE");
    const dogsitting = computeStatus("DOGSITTING");
    const pension = computeStatus("PENSION");

    return {
      date,
      promenadeStatus: promenade.status,
      dogsittingStatus: dogsitting.status,
      pensionStatus: pension.status,
      promenadePartial: promenade.partial,
      dogsittingPartial: dogsitting.partial,
      pensionPartial: pension.partial,
    };
  });

  return {
    days,
    metrics: {
      rulesCount: (allRules ?? []).length,
      exceptionsCount: (allExceptions ?? []).length,
      bookingsCount: (allBookings ?? []).length,
      configsCount: (allConfigs ?? []).length,
      bookingsPerDayMin: min,
      bookingsPerDayMax: max,
      bookingsPerDayAvg: dates.length ? sum / dates.length : 0,
    },
  };
}
