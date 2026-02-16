import { prisma } from "../prisma.ts";

import { summarizeDayStatusFromSlots } from "./dayStatus.ts";

export type ServiceType = "PROMENADE" | "DOGSITTING" | "PENSION";

export type SlotStatus = "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";

export type DaySlot = {
  startAt: string;
  endAt: string;
  startMin: number;
  endMin: number;
  status: SlotStatus;
  reason?: string;
};

export type BoardingRangeStatus = "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";

export type BoardingRangeDay = {
  date: string;
  status: BoardingRangeStatus;
  reason?: string;
};

export type BoardingRangeResult = {
  startDate: string;
  endDate: string;
  status: BoardingRangeStatus;
  days: BoardingRangeDay[];
  blockingDays?: BoardingRangeDay[];
};

export type GenerateDaySlotsInput = {
  sitterId: string;
  serviceType: ServiceType;
  date: string;
  now?: Date;
};

export type PublicServiceConfig = {
  minDurationMin: number;
  stepMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  leadTimeMin: number;
};

type Interval = {
  startMin: number;
  endMin: number;
  status: SlotStatus;
  reason?: string;
};

type BookingBlock = {
  startAt: Date;
  endAt: Date;
  kind: "HARD" | "SOFT";
  reason: string;
};

export const TIMEZONE_ZURICH = "Europe/Zurich";
const ZURICH_TZ = TIMEZONE_ZURICH;

export const SERVICE_DEFAULTS: Record<ServiceType, ServiceConfigDefaults> = {
  PROMENADE: {
    serviceType: "PROMENADE",
    enabled: true,
    slotStepMin: 30,
    minDurationMin: 30,
    maxDurationMin: 120,
    leadTimeMin: 120,
    bufferBeforeMin: 15,
    bufferAfterMin: 15,
    overnightRequired: false,
    checkInStartMin: null,
    checkInEndMin: null,
    checkOutStartMin: null,
    checkOutEndMin: null,
  },
  DOGSITTING: {
    serviceType: "DOGSITTING",
    enabled: true,
    slotStepMin: 60,
    minDurationMin: 120,
    maxDurationMin: 720,
    leadTimeMin: 180,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    overnightRequired: false,
    checkInStartMin: null,
    checkInEndMin: null,
    checkOutStartMin: null,
    checkOutEndMin: null,
  },
  PENSION: {
    serviceType: "PENSION",
    enabled: true,
    slotStepMin: 60,
    minDurationMin: 60,
    maxDurationMin: 24 * 60,
    leadTimeMin: 24 * 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    overnightRequired: true,
    checkInStartMin: 8 * 60,
    checkInEndMin: 19 * 60,
    checkOutStartMin: 8 * 60,
    checkOutEndMin: 12 * 60,
  },
};

type AvailabilityRuleRow = {
  sitterId: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  status: "AVAILABLE" | "ON_REQUEST";
};

type AvailabilityExceptionRow = {
  sitterId: string;
  date: Date;
  startMin: number;
  endMin: number;
  status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
};

type ServiceConfigRow = {
  sitterId: string;
  serviceType: ServiceType;
  enabled: boolean;
  slotStepMin: number;
  minDurationMin: number;
  maxDurationMin: number;
  leadTimeMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  overnightRequired: boolean;
  checkInStartMin: number | null;
  checkInEndMin: number | null;
  checkOutStartMin: number | null;
  checkOutEndMin: number | null;
};

type ServiceConfigDefaults = Omit<ServiceConfigRow, "sitterId">;

type BookingRow = {
  status: string;
  createdAt: Date;
  startAt?: Date | null;
  endAt?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
};

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getZurichDateIso(dt: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZURICH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function clampMin(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(24 * 60, Math.round(v)));
}

function normalizeInterval(i: Interval): Interval | null {
  const startMin = clampMin(i.startMin);
  const endMin = clampMin(i.endMin);
  if (endMin <= startMin) return null;
  return { ...i, startMin, endMin };
}

function mergeSameStatus(intervals: Interval[]) {
  const sorted = intervals
    .map((i) => normalizeInterval(i))
    .filter((i): i is Interval => Boolean(i))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const out: Interval[] = [];
  for (const cur of sorted) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(cur);
      continue;
    }
    if (prev.status === cur.status && prev.reason === cur.reason && cur.startMin <= prev.endMin) {
      prev.endMin = Math.max(prev.endMin, cur.endMin);
      continue;
    }
    if (cur.startMin < prev.endMin && prev.status === cur.status && prev.reason === cur.reason) {
      prev.endMin = Math.max(prev.endMin, cur.endMin);
      continue;
    }
    out.push(cur);
  }
  return out;
}

function applyOverride(base: Interval[], override: Interval[]) {
  let result = base.slice();
  for (const oRaw of override) {
    const o = normalizeInterval(oRaw);
    if (!o) continue;

    const next: Interval[] = [];
    for (const b of result) {
      if (o.endMin <= b.startMin || o.startMin >= b.endMin) {
        next.push(b);
        continue;
      }
      if (o.startMin > b.startMin) {
        next.push({ ...b, endMin: o.startMin });
      }
      next.push(o);
      if (o.endMin < b.endMin) {
        next.push({ ...b, startMin: o.endMin });
      }
    }
    result = mergeSameStatus(next);
  }
  return mergeSameStatus(result);
}

function subtractBlock(base: Interval[], block: Interval) {
  const b = normalizeInterval(block);
  if (!b) return base;
  const next: Interval[] = [];
  for (const i of base) {
    if (b.endMin <= i.startMin || b.startMin >= i.endMin) {
      next.push(i);
      continue;
    }
    if (b.startMin > i.startMin) next.push({ ...i, endMin: b.startMin });
    if (b.endMin < i.endMin) next.push({ ...i, startMin: b.endMin });
  }
  return mergeSameStatus(next);
}

function minutesToIso(dateIso: string, minutes: number) {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const parts = dateIso.split("-");
  if (parts.length !== 3) return new Date(NaN);
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return new Date(NaN);
  return new Date(Date.UTC(y, mo - 1, d, hh, mm, 0, 0));
}

function formatZurichOffsetIso(dt: Date) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZURICH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  });
  const parts = dtf.formatToParts(dt);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const mo = get("month");
  const d = get("day");
  const h = get("hour") || "00";
  const m = get("minute") || "00";
  const s = get("second") || "00";
  const tz = get("timeZoneName") || "GMT";
  const mOffset = tz.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
  let offset = "Z";
  if (mOffset) {
    const signNum = Number(mOffset[1]);
    const sign = signNum >= 0 ? "+" : "-";
    const hhOff = String(Math.abs(signNum)).padStart(2, "0");
    const mmOff = String(mOffset[2] ?? "00").padStart(2, "0");
    offset = `${sign}${hhOff}:${mmOff}`;
  }
  return `${y}-${mo}-${d}T${h}:${m}:${s}${offset}`;
}

function minutesToZurichOffsetIso(dateIso: string, minutes: number) {
  return formatZurichOffsetIso(minutesToIso(dateIso, minutes));
}

function toPublicConfig(config: ServiceConfigRow): PublicServiceConfig {
  return {
    minDurationMin: config.minDurationMin,
    stepMin: config.slotStepMin,
    bufferBeforeMin: config.bufferBeforeMin,
    bufferAfterMin: config.bufferAfterMin,
    leadTimeMin: config.leadTimeMin,
  };
}

function dayOfWeekZurich(dateIso: string) {
  const dt = new Date(`${dateIso}T12:00:00Z`);
  const short = new Intl.DateTimeFormat("en-US", { timeZone: ZURICH_TZ, weekday: "short" }).format(dt);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return typeof map[short] === "number" ? map[short] : 0;
}

export function dayOfWeekForZurichDate(dateIso: string) {
  return dayOfWeekZurich(dateIso);
}

function normalizeRuleIntervals(rules: AvailabilityRuleRow[]) {
  return rules
    .map((r) => ({
      startMin: r.startMin,
      endMin: r.endMin,
      status: r.status === "ON_REQUEST" ? ("ON_REQUEST" as const) : ("AVAILABLE" as const),
      reason: r.status === "ON_REQUEST" ? "rule_on_request" : "rule_available",
    }))
    .map((i) => normalizeInterval(i))
    .filter((i): i is Interval => Boolean(i));
}

function normalizeExceptionIntervals(exceptions: AvailabilityExceptionRow[]) {
  return exceptions
    .map((e) => ({
      startMin: e.startMin,
      endMin: e.endMin,
      status: e.status as SlotStatus,
      reason:
        e.status === "UNAVAILABLE"
          ? "exception_unavailable"
          : e.status === "ON_REQUEST"
            ? "exception_on_request"
            : "exception_available",
    }))
    .map((i) => normalizeInterval(i))
    .filter((i): i is Interval => Boolean(i));
}

function bookingToBlock(b: BookingRow, now: Date): BookingBlock | null {
  const status = typeof b.status === "string" ? b.status : "";
  if (status === "CANCELLED" || status === "REFUNDED" || status === "PAYMENT_FAILED" || status === "REFUND_FAILED") return null;

  if (status === "CONFIRMED" || status === "PAID") {
    const startAt = (b as any).startAt ?? (b as any).startDate;
    const endAt = (b as any).endAt ?? (b as any).endDate;
    if (!startAt || !endAt) return null;
    return { startAt, endAt, kind: "HARD", reason: status === "PAID" ? "booking_paid_overlap" : "booking_confirmed_overlap" };
  }

  if (status === "PENDING_PAYMENT" || status === "PENDING_ACCEPTANCE") {
    const createdAt = b.createdAt;
    const ttlMs = status === "PENDING_PAYMENT" ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000;
    if (!createdAt || now.getTime() - createdAt.getTime() > ttlMs) return null;

    const startAt = (b as any).startAt ?? (b as any).startDate;
    const endAt = (b as any).endAt ?? (b as any).endDate;
    if (!startAt || !endAt) return null;
    return {
      startAt,
      endAt,
      kind: "SOFT",
      reason: status === "PENDING_PAYMENT" ? "booking_pending_payment_overlap" : "booking_pending_acceptance_overlap",
    };
  }

  return null;
}

function toDayMinRange(dateIso: string, dt: Date) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZURICH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(dt);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const mo = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const localDate = `${y}-${mo}-${d}`;
  if (localDate !== dateIso) return null;
  return clampMin(h * 60 + m);
}

export type ComputeDaySlotsInput = {
  date: string;
  serviceType: ServiceType;
  now: Date;
  rules: AvailabilityRuleRow[];
  exceptions: AvailabilityExceptionRow[];
  bookings: BookingRow[];
  config: ServiceConfigRow;
};

export function computeDaySlots(input: ComputeDaySlotsInput): DaySlot[] {
  if (!isValidIsoDate(input.date)) return [];
  const now = input.now;

  const hardBlocks: Interval[] = [];
  const softBlocks: Interval[] = [];
  for (const b of input.bookings ?? []) {
    const block = bookingToBlock(b, now);
    if (!block) continue;

    const startIso = getZurichDateIso(block.startAt);
    const endIso = getZurichDateIso(block.endAt);
    if (input.date < startIso || input.date > endIso) continue;

    const startMin = input.date === startIso ? toDayMinRange(input.date, block.startAt) : 0;
    const endMin = input.date === endIso ? toDayMinRange(input.date, block.endAt) : 24 * 60;
    if (startMin === null || endMin === null) continue;
    if (endMin <= startMin) continue;

    const expanded: Interval = {
      startMin: startMin - (block.kind === "HARD" ? input.config.bufferBeforeMin : 0),
      endMin: endMin + (block.kind === "HARD" ? input.config.bufferAfterMin : 0),
      status: block.kind === "HARD" ? "UNAVAILABLE" : "ON_REQUEST",
      reason: block.reason,
    };

    if (block.kind === "HARD") hardBlocks.push(expanded);
    else softBlocks.push({ ...expanded, status: "ON_REQUEST" });
  }

  const baseFromRules = mergeSameStatus(normalizeRuleIntervals(input.rules));
  const baseWithExceptions = applyOverride(baseFromRules, normalizeExceptionIntervals(input.exceptions));

  // Hard blocks override the agenda to UNAVAILABLE (instead of subtracting), so we can expose UNAVAILABLE slots + reasons.
  const hardOverrides: Interval[] = hardBlocks.map((b) => ({
    startMin: b.startMin,
    endMin: b.endMin,
    status: "UNAVAILABLE",
    reason: b.reason,
  }));
  const agenda = applyOverride(baseWithExceptions, hardOverrides);

  function statusForRange(startMin: number, endMin: number): { status: SlotStatus; reason?: string } {
    let sawAvailable = false;
    let onRequestReason: string | undefined;
    for (const seg of agenda) {
      if (seg.endMin <= startMin || seg.startMin >= endMin) continue;
      if (seg.status === "UNAVAILABLE") {
        return { status: "UNAVAILABLE", reason: seg.reason };
      }
      if (seg.status === "ON_REQUEST" && !onRequestReason) {
        onRequestReason = seg.reason;
      }
      if (seg.status === "AVAILABLE") {
        sawAvailable = true;
      }
    }
    if (onRequestReason) return { status: "ON_REQUEST", reason: onRequestReason };
    if (sawAvailable) return { status: "AVAILABLE" };
    return { status: "UNAVAILABLE", reason: "outside_rule" };
  }

  const slots: DaySlot[] = [];
  const step = Math.max(1, input.config.slotStepMin);
  const duration = Math.max(1, input.config.minDurationMin);

  const leadTimeMin = Math.max(0, input.config.leadTimeMin);
  const nowMin = toDayMinRange(input.date, now);

  const seenStarts = new Set<number>();
  for (const interval of agenda) {
    const firstStart = Math.ceil(interval.startMin / step) * step;
    for (let startMin = firstStart; startMin < interval.endMin; startMin += step) {
      if (seenStarts.has(startMin)) continue;
      seenStarts.add(startMin);
      const endMin = startMin + duration;
      if (endMin > 24 * 60) continue;

      const base = statusForRange(startMin, endMin);
      let status: SlotStatus = base.status;
      let reason = base.reason;

      // Lead time gating.
      if (status !== "UNAVAILABLE" && nowMin !== null && startMin - nowMin < leadTimeMin) {
        status = "UNAVAILABLE";
        reason = "lead_time";
      }

      // Soft blocks degrade to ON_REQUEST unless already UNAVAILABLE.
      if (status !== "UNAVAILABLE") {
        for (const sb of softBlocks) {
          if (sb.endMin <= startMin || sb.startMin >= endMin) continue;
          status = "ON_REQUEST";
          reason = sb.reason;
          break;
        }
      }

      const startAt = minutesToZurichOffsetIso(input.date, startMin);
      const endAt = minutesToZurichOffsetIso(input.date, endMin);
      slots.push({ startAt, endAt, startMin, endMin, status, reason });
    }
  }

  slots.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  return slots;
}

export async function generateDaySlots(
  input: GenerateDaySlotsInput
): Promise<{ ok: true; slots: DaySlot[]; config: PublicServiceConfig } | { ok: false; error: string }> {
  try {
    const sitterId = input.sitterId?.trim() ?? "";
    const date = input.date?.trim() ?? "";
    if (!sitterId) return { ok: false, error: "INVALID_SITTER" };
    if (!isValidIsoDate(date)) return { ok: false, error: "INVALID_DATE" };

    const now = input.now ?? new Date();
    const dow = dayOfWeekZurich(date);

    const [rules, exceptions, bookings, config] = await Promise.all([
      (prisma as any).availabilityRule.findMany({ where: { sitterId, dayOfWeek: dow } }) as Promise<AvailabilityRuleRow[]>,
      (prisma as any).availabilityException.findMany({ where: { sitterId, date: new Date(`${date}T00:00:00Z`) } }) as Promise<AvailabilityExceptionRow[]>,
      (prisma as any).booking.findMany({ where: { sitterId } }) as Promise<BookingRow[]>,
      (prisma as any).serviceConfig.findUnique({ where: { sitterId_serviceType: { sitterId, serviceType: input.serviceType } } }) as Promise<ServiceConfigRow | null>,
    ]);

    const mergedConfig: ServiceConfigRow = config
      ? config
      : ({
          ...SERVICE_DEFAULTS[input.serviceType],
          sitterId,
        } as ServiceConfigRow);

    const slots = computeDaySlots({
      date,
      serviceType: input.serviceType,
      now,
      rules,
      exceptions,
      bookings,
      config: mergedConfig,
    });

    return { ok: true, slots, config: toPublicConfig(mergedConfig) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message || "INTERNAL_ERROR" };
  }
}

export type CheckBoardingRangeInput = {
  sitterId: string;
  startDate: string;
  endDate: string;
  now?: Date;
};

export type EvaluateBoardingRangeFromDataInput = {
  sitterId: string;
  startDate: string;
  endDate: string;
  now: Date;
  rules: AvailabilityRuleRow[];
  exceptions: AvailabilityExceptionRow[];
  bookings: BookingRow[];
  config: ServiceConfigRow;
};

function addDaysIso(iso: string, deltaDays: number) {
  const dt = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return iso;
  const next = new Date(dt.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  return getZurichDateIso(next);
}

export function evaluateBoardingRangeFromData(input: EvaluateBoardingRangeFromDataInput): BoardingRangeResult {
  const { sitterId, startDate, endDate, now } = input;
  if (!sitterId) {
    return { startDate, endDate, status: "UNAVAILABLE", days: [], blockingDays: [{ date: startDate, status: "UNAVAILABLE", reason: "INVALID_SITTER" }] };
  }
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    return { startDate, endDate, status: "UNAVAILABLE", days: [], blockingDays: [{ date: startDate, status: "UNAVAILABLE", reason: "INVALID_DATE" }] };
  }
  if (endDate <= startDate) {
    return { startDate, endDate, status: "UNAVAILABLE", days: [], blockingDays: [{ date: startDate, status: "UNAVAILABLE", reason: "INVALID_RANGE" }] };
  }

  const days: BoardingRangeDay[] = [];
  const blockingDays: BoardingRangeDay[] = [];
  let hasOnRequest = false;

  function summarizeBoardingDay(slots: DaySlot[]): { status: BoardingRangeStatus; reason?: string } {
    let sawAvailable = false;
    let onRequestReason: string | undefined;
    for (const s of slots) {
      if (!s) continue;
      if (s.status === "UNAVAILABLE") return { status: "UNAVAILABLE", reason: s.reason };
      if (s.status === "ON_REQUEST" && !onRequestReason) onRequestReason = s.reason;
      if (s.status === "AVAILABLE") sawAvailable = true;
    }
    if (onRequestReason) return { status: "ON_REQUEST", reason: onRequestReason };
    if (sawAvailable) return { status: "AVAILABLE" };
    return { status: "UNAVAILABLE", reason: "outside_rule" };
  }

  for (let d = startDate; d < endDate; d = addDaysIso(d, 1)) {
    const dow = dayOfWeekZurich(d);
    const rules = input.rules.filter((r) => r.dayOfWeek === dow);
    const exceptions = input.exceptions.filter((e) => getZurichDateIso(e.date) === d);

    const slots = computeDaySlots({
      date: d,
      serviceType: "PENSION",
      now,
      rules,
      exceptions,
      bookings: input.bookings,
      config: input.config,
    });

    const summarized = summarizeBoardingDay(slots);
    const status = summarized.status;
    const reason = summarized.reason;

    if (status === "UNAVAILABLE") {
      blockingDays.push({ date: d, status, reason });
    } else if (status === "ON_REQUEST") {
      hasOnRequest = true;
    }
    days.push({ date: d, status, reason });
  }

  const overall: BoardingRangeStatus = blockingDays.length ? "UNAVAILABLE" : hasOnRequest ? "ON_REQUEST" : "AVAILABLE";
  return { startDate, endDate, status: overall, days, blockingDays: blockingDays.length ? blockingDays : undefined };
}

export async function checkBoardingRange(input: CheckBoardingRangeInput): Promise<{ ok: true; result: BoardingRangeResult } | { ok: false; error: string }> {
  try {
    const sitterId = input.sitterId?.trim() ?? "";
    const startDate = input.startDate?.trim() ?? "";
    const endDate = input.endDate?.trim() ?? "";
    if (!sitterId) return { ok: false, error: "INVALID_SITTER" };
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) return { ok: false, error: "INVALID_DATE" };
    if (endDate <= startDate) return { ok: false, error: "INVALID_RANGE" };

    const now = input.now ?? new Date();
    const startDt = new Date(`${startDate}T00:00:00.000Z`);
    const endDt = new Date(`${endDate}T23:59:59.999Z`);

    const [rules, exceptions, bookings, configRow] = await Promise.all([
      (prisma as any).availabilityRule.findMany({ where: { sitterId, serviceType: "PENSION" } }) as Promise<AvailabilityRuleRow[]>,
      (prisma as any).availabilityException.findMany({ where: { sitterId, serviceType: "PENSION", date: { gte: startDate, lte: endDate } } }) as Promise<AvailabilityExceptionRow[]>,
      (prisma as any).booking.findMany({
        where: {
          sitterId,
          startAt: { lt: endDt },
          endAt: { gt: startDt },
        },
      }) as Promise<BookingRow[]>,
      (prisma as any).serviceConfig.findFirst({ where: { sitterId, serviceType: "PENSION" } }) as Promise<ServiceConfigRow | null>,
    ]);

    const mergedConfig: ServiceConfigRow = {
      ...SERVICE_DEFAULTS.PENSION,
      sitterId,
      ...(configRow ?? {}),
      serviceType: "PENSION",
    };

    const result = evaluateBoardingRangeFromData({
      sitterId,
      startDate,
      endDate,
      now,
      rules: rules ?? [],
      exceptions: exceptions ?? [],
      bookings: bookings ?? [],
      config: mergedConfig,
    });

    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message || "INTERNAL_ERROR" };
  }
}
