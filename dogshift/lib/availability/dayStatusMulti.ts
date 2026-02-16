import { SERVICE_DEFAULTS, computeDaySlots, dayOfWeekForZurichDate, TIMEZONE_ZURICH, type ServiceType } from "./slotEngine.ts";
import { summarizeDayStatusFromSlots } from "./dayStatus.ts";

export type MultiServiceDayStatus = {
  date: string;
  promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
  dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
  pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
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

function bookingEndDate(b: any) {
  const v = b?.endAt ?? b?.endDate;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const dt = new Date(v);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
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

export function computeMultiDayStatusNaive(input: DayStatusMultiInput): MultiServiceDayStatus[] {
  const { sitterId, dates, now, allRules, allExceptions, allBookings, allConfigs } = input;

  const configByService = new Map<ServiceType, any>();
  for (const row of allConfigs ?? []) {
    const st = row?.serviceType as ServiceType;
    if (st === "PROMENADE" || st === "DOGSITTING" || st === "PENSION") {
      configByService.set(st, ensureServiceConfig(sitterId, st, row));
    }
  }

  return dates.map((date) => {
    const dow = dayOfWeekForZurichDate(date);

    const computeStatus = (serviceType: ServiceType) => {
      const rules = (allRules ?? []).filter((r: any) => r && r.serviceType === serviceType && r.dayOfWeek === dow);
      const exceptions = (allExceptions ?? []).filter((e: any) => e && e.serviceType === serviceType && exceptionDateKey(e) === date);
      const config = configByService.get(serviceType) ?? ensureServiceConfig(sitterId, serviceType, null);
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
    PROMENADE: ensureServiceConfig(sitterId, "PROMENADE", null),
    DOGSITTING: ensureServiceConfig(sitterId, "DOGSITTING", null),
    PENSION: ensureServiceConfig(sitterId, "PENSION", null),
  };

  for (const row of allConfigs ?? []) {
    const st = row?.serviceType as ServiceType;
    if (st === "PROMENADE" || st === "DOGSITTING" || st === "PENSION") {
      configByService[st] = ensureServiceConfig(sitterId, st, row);
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
    const endIso = toZurichIsoDate(endAt);
    if (!startIso || !endIso) continue;

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
      const slots = computeDaySlots({
        serviceType,
        date,
        now,
        rules,
        exceptions,
        bookings,
        config,
      });
      return summarizeDayStatusFromSlots(slots);
    };

    return {
      date,
      promenadeStatus: computeStatus("PROMENADE"),
      dogsittingStatus: computeStatus("DOGSITTING"),
      pensionStatus: computeStatus("PENSION"),
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
