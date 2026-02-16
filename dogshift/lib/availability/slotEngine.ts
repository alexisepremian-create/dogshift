import { prisma } from "@/lib/prisma";

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

export type BoardingRangeResult = {
  status: BoardingRangeStatus;
  reason?: string;
};

export type GenerateDaySlotsInput = {
  sitterId: string;
  serviceType: ServiceType;
  date: string;
  now?: Date;
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

const ZURICH_TZ = "Europe/Zurich";

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

function dayOfWeekZurich(dateIso: string) {
  const dt = new Date(`${dateIso}T12:00:00Z`);
  const short = new Intl.DateTimeFormat("en-US", { timeZone: ZURICH_TZ, weekday: "short" }).format(dt);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return typeof map[short] === "number" ? map[short] : 0;
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
  for (const b of input.bookings) {
    const block = bookingToBlock(b, now);
    if (!block) continue;

    const startMin = toDayMinRange(input.date, block.startAt);
    const endMin = toDayMinRange(input.date, block.endAt);
    if (startMin === null || endMin === null) continue;

    const expanded: Interval = {
      startMin: startMin - input.config.bufferBeforeMin,
      endMin: endMin + input.config.bufferAfterMin,
      status: "UNAVAILABLE",
      reason: block.reason,
    };

    if (block.kind === "HARD") hardBlocks.push(expanded);
    else softBlocks.push({ ...expanded, status: "ON_REQUEST" });
  }

  const baseFromRules = mergeSameStatus(normalizeRuleIntervals(input.rules));
  const baseWithExceptions = applyOverride(baseFromRules, normalizeExceptionIntervals(input.exceptions));

  let agenda = baseWithExceptions.filter((i) => i.status !== "UNAVAILABLE");
  for (const hb of hardBlocks) {
    agenda = subtractBlock(agenda, hb);
  }
  agenda = mergeSameStatus(agenda);

  const slots: DaySlot[] = [];
  const step = Math.max(1, input.config.slotStepMin);
  const duration = Math.max(1, input.config.minDurationMin);

  const leadTimeMin = Math.max(0, input.config.leadTimeMin);
  const nowMin = toDayMinRange(input.date, now);

  for (const interval of agenda) {
    const firstStart = Math.ceil(interval.startMin / step) * step;
    for (let startMin = firstStart; startMin + duration <= interval.endMin; startMin += step) {
      const endMin = startMin + duration;
      let status: SlotStatus = interval.status;
      let reason = interval.reason;

      if (nowMin !== null && startMin - nowMin < leadTimeMin) {
        status = "UNAVAILABLE";
        reason = "lead_time";
      }

      if (status !== "UNAVAILABLE") {
        for (const sb of softBlocks) {
          if (sb.endMin <= startMin || sb.startMin >= endMin) continue;
          status = "ON_REQUEST";
          reason = sb.reason;
          break;
        }
      }

      const startAt = minutesToIso(input.date, startMin).toISOString();
      const endAt = minutesToIso(input.date, endMin).toISOString();
      slots.push({ startAt, endAt, startMin, endMin, status, reason });
    }
  }

  slots.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  return slots;
}

export async function generateDaySlots(input: GenerateDaySlotsInput): Promise<{ ok: true; slots: DaySlot[] } | { ok: false; error: string }> {
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

    return { ok: true, slots };
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

export async function checkBoardingRange(_input: CheckBoardingRangeInput): Promise<{ ok: true; result: BoardingRangeResult } | { ok: false; error: string }> {
  return { ok: false, error: "NOT_IMPLEMENTED" };
}
