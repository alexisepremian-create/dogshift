import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { commerceBlockedResponse } from "@/lib/platform/maintenance";
import { DOGSHIFT_COMMISSION_RATE } from "@/lib/commission";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { checkBoardingRange, generateDaySlots, type ServiceType } from "@/lib/availability/slotEngine";
import { BOOKING_ACCESS_COOKIE, isBookingAccessCodeProtectionEnabled } from "@/lib/bookingAccess";
import { zodParse } from "@/lib/validators/common";
import { createBookingSchema } from "@/lib/validators/bookings";
import { logAudit } from "@/lib/audit";
import { recordBookingFinanceEvent } from "@/lib/financeEvents";

export const runtime = "nodejs";

type CreateBookingBody = {
  sitterId?: unknown;
  service?: unknown;
  startDate?: unknown; // ISO yyyy-mm-dd
  endDate?: unknown; // ISO yyyy-mm-dd
  startAt?: unknown; // ISO datetime
  endAt?: unknown; // ISO datetime
  message?: unknown;
};

type StayRule = {
  minStayDays?: number;
  maxStayDays?: number;
};

const SERVICE_STAY_RULES: Record<string, StayRule> = {
  Pension: {},
  Garde: {},
};

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatZurichIsoDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function todayZurichIsoDate() {
  return formatZurichIsoDate(new Date());
}

function isoDateToUtcMidnight(iso: string) {
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function addDaysUtc(date: Date, deltaDays: number) {
  return new Date(date.getTime() + deltaDays * 24 * 60 * 60 * 1000);
}

function dateRangeUtcMidnightsInclusive(startIso: string, endIso: string) {
  const start = isoDateToUtcMidnight(startIso);
  const end = isoDateToUtcMidnight(endIso);
  if (!start || !end) return null;
  if (end.getTime() < start.getTime()) return null;
  const out: Date[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDaysUtc(d, 1)) {
    out.push(d);
  }
  return out;
}

function dateRangeIsoInclusive(startIso: string, endIso: string) {
  if (!isValidIsoDate(startIso) || !isValidIsoDate(endIso)) return null;
  const start = isoDateToUtcMidnight(startIso);
  const end = isoDateToUtcMidnight(endIso);
  if (!start || !end) return null;
  if (end.getTime() < start.getTime()) return null;
  const out: string[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDaysUtc(d, 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function daysBetweenInclusive(start: string, end: string) {
  if (!isValidIsoDate(start) || !isValidIsoDate(end)) return 1;
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  const diff = Math.round((b - a) / (24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

function toCents(amountChf: number) {
  return Math.round(amountChf * 100);
}

function isValidIsoDatetime(value: string) {
  const t = new Date(value).getTime();
  return Number.isFinite(t);
}

function hoursRoundedToHalf(startAtIso: string, endAtIso: string) {
  if (!isValidIsoDatetime(startAtIso) || !isValidIsoDatetime(endAtIso)) return null;
  const a = new Date(startAtIso).getTime();
  const b = new Date(endAtIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  const minutes = (b - a) / (60 * 1000);
  const hoursRaw = minutes / 60;
  const hoursRounded = Math.ceil(hoursRaw * 2) / 2;
  return Math.max(0.5, hoursRounded);
}

function serviceToAvailabilityType(service: string): ServiceType | null {
  if (service === "Promenade") return "PROMENADE";
  if (service === "Garde") return "DOGSITTING";
  if (service === "Pension") return "PENSION";
  return null;
}

function isConflictBlockingStatus(status: string) {
  return status === "PENDING_ACCEPTANCE" || status === "PAID" || status === "CONFIRMED";
}

const BOOKING_CONFLICT_BUFFER_MINUTES = 30;
const MIN_LEAD_TIME_MINUTES = 30;
const DEFAULT_MIN_ADVANCE_HOURS = 24;

function withBuffer(date: Date, deltaMinutes: number) {
  return new Date(date.getTime() + deltaMinutes * 60 * 1000);
}

function sameInstantIso(a: string, b: string) {
  const aTime = new Date(a).getTime();
  const bTime = new Date(b).getTime();
  return Number.isFinite(aTime) && Number.isFinite(bTime) && aTime === bTime;
}

export async function POST(req: NextRequest) {
  try {
    const maintenance = await commerceBlockedResponse();
    if (maintenance) return maintenance;

    if (isBookingAccessCodeProtectionEnabled()) {
      const bookingAccessGranted = req.cookies.get(BOOKING_ACCESS_COOKIE)?.value === "true";
      if (!bookingAccessGranted) {
        return NextResponse.json({ ok: false, error: "BOOKING_ACCESS_REQUIRED" }, { status: 403 });
      }
    }

    const userId = await resolveDbUserId(req);
    if (!userId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][bookings][POST] UNAUTHORIZED");
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const parsed = zodParse(createBookingSchema, rawBody);
    if (!parsed.ok) return parsed.response;

    const body = parsed.data as CreateBookingBody;
    const sitterId = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    const service = typeof body?.service === "string" ? body.service.trim() : "";
    const startDate = typeof body?.startDate === "string" ? body.startDate.trim() : "";
    const endDate = typeof body?.endDate === "string" ? body.endDate.trim() : "";
    const startAt = typeof body?.startAt === "string" ? body.startAt.trim() : "";
    const endAt = typeof body?.endAt === "string" ? body.endAt.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : null;

    if (!sitterId) return NextResponse.json({ ok: false, error: "INVALID_SITTER" }, { status: 400 });
    if (!service) return NextResponse.json({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });
    const hasHourlyDates = Boolean(startAt && endAt);
    const hasDailyDates = Boolean(startDate && endDate);
    if (!hasHourlyDates && !hasDailyDates) {
      return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
    }

    const isDailyService = service === "Pension" || service === "Garde";
    const isHourlyService = service === "Promenade";

    // Service-specific expected payload.
    if (isDailyService) {
      if (hasHourlyDates || !hasDailyDates) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
    }
    if (isHourlyService) {
      if (!hasHourlyDates) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
      // Promenade: a single day is implied by the hourly range.
      if (hasDailyDates) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
    }

    if (hasHourlyDates) {
      if (!isValidIsoDatetime(startAt) || !isValidIsoDatetime(endAt)) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
    }

    if (hasDailyDates) {
      if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
    }

    // Global date gating (Europe/Zurich): no past dates.
    const todayIso = todayZurichIsoDate();
    if (hasDailyDates) {
      if (startDate < todayIso || endDate < todayIso) {
        return NextResponse.json({ ok: false, error: "PAST_DATE" }, { status: 400 });
      }
      if (endDate < startDate) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }

      // Optional stay rules (prepared for future per-service min/max stay).
      const days = daysBetweenInclusive(startDate, endDate);
      const rules = SERVICE_STAY_RULES[service] ?? {};
      if (typeof rules.minStayDays === "number" && Number.isFinite(rules.minStayDays) && days < rules.minStayDays) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
      if (typeof rules.maxStayDays === "number" && Number.isFinite(rules.maxStayDays) && days > rules.maxStayDays) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
    }
    if (hasHourlyDates) {
      const startDt = new Date(startAt);
      if (!Number.isFinite(startDt.getTime())) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
      const startLocalIso = formatZurichIsoDate(startDt);
      if (startLocalIso < todayIso) {
        return NextResponse.json({ ok: false, error: "PAST_DATE" }, { status: 400 });
      }
    }

    const sitterProfile = await (prisma as any).sitterProfile.findFirst({
      where: { sitterId, published: true },
      select: { sitterId: true, pricing: true },
    });

    if (!sitterProfile?.sitterId) {
      return NextResponse.json({ ok: false, error: "SITTER_NOT_FOUND" }, { status: 404 });
    }

    const pricing = sitterProfile.pricing && typeof sitterProfile.pricing === "object" ? (sitterProfile.pricing as Record<string, unknown>) : {};
    const rawPrice = pricing[service];
    const unit = typeof rawPrice === "number" && Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null;

    if (unit === null) {
      return NextResponse.json({ ok: false, error: "SERVICE_NOT_AVAILABLE" }, { status: 400 });
    }

    let totalChf: number | null = null;
    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;
    const availabilityServiceType = serviceToAvailabilityType(service);

    if (!availabilityServiceType) {
      return NextResponse.json({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });
    }

    if (isDailyService) {
      if (!hasDailyDates) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
      const days = daysBetweenInclusive(startDate, endDate);
      totalChf = unit * days;
      startDateTime = new Date(`${startDate}T00:00:00Z`);
      endDateTime = new Date(`${endDate}T00:00:00Z`);
    } else if (hasHourlyDates) {
      const hours = hoursRoundedToHalf(startAt, endAt);
      if (hours === null) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
      totalChf = unit * hours;
      startDateTime = new Date(startAt);
      endDateTime = new Date(endAt);
    } else {
      return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
    }

    if (totalChf === null) {
      return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
    }

    if (!startDateTime || !endDateTime || !Number.isFinite(startDateTime.getTime()) || !Number.isFinite(endDateTime.getTime())) {
      return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
    }

    // Product rules:
    // - <30min: always blocked
    // - 30min-24h: allowed only if sitter's global last-minute is enabled
    // - >24h: normal flow
    const deltaMs = startDateTime.getTime() - Date.now();
    const minLeadMs = MIN_LEAD_TIME_MINUTES * 60 * 1000;
    if (!Number.isFinite(deltaMs) || deltaMs < minLeadMs) {
      return NextResponse.json(
        {
          ok: false,
          error: "LEAD_TIME",
          message: "Les réservations doivent être effectuées au minimum 30 minutes à l’avance.",
        },
        { status: 400 }
      );
    }

    const sitterLastMinute = await (prisma as any).sitterProfile.findUnique({
      where: { sitterId },
      select: { lastMinuteEnabled: true },
    });
    const lastMinuteEnabled = Boolean(sitterLastMinute?.lastMinuteEnabled);

    const minAdvanceMs = DEFAULT_MIN_ADVANCE_HOURS * 60 * 60 * 1000;
    if (deltaMs < minAdvanceMs && !lastMinuteEnabled) {
      return NextResponse.json(
        {
          ok: false,
          error: "LAST_MINUTE_DISABLED",
          message: "Les réservations doivent être effectuées au minimum 24h à l’avance.",
        },
        { status: 400 }
      );
    }

    if (availabilityServiceType === "PENSION") {
      const boarding = await checkBoardingRange({
        sitterId,
        startDate,
        endDate,
        now: new Date(),
      });
      if (!boarding.ok || boarding.result.status === "UNAVAILABLE") {
        return NextResponse.json({ ok: false, error: "DATE_NOT_AVAILABLE" }, { status: 400 });
      }
    } else {
      const targetDateIso = formatZurichIsoDate(startDateTime);
      const requestedDurationMin = Math.round((endDateTime.getTime() - startDateTime.getTime()) / (60 * 1000));
      if (!Number.isFinite(requestedDurationMin) || requestedDurationMin <= 0) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
      const daySlots = await generateDaySlots({
        sitterId,
        serviceType: availabilityServiceType,
        date: targetDateIso,
        now: new Date(),
        durationMin: requestedDurationMin,
      });
      if (!daySlots.ok) {
        return NextResponse.json({ ok: false, error: "DATE_NOT_AVAILABLE" }, { status: 400 });
      }
      const selectedSlot = daySlots.slots.find(
        (slot) =>
          (slot.status === "AVAILABLE" || slot.status === "ON_REQUEST") &&
          sameInstantIso(slot.startAt, startAt) &&
          sameInstantIso(slot.endAt, endAt)
      );
      if (!selectedSlot) {
        return NextResponse.json({ ok: false, error: "DATE_NOT_AVAILABLE" }, { status: 400 });
      }

      // Hard guard: ensure the selection ends within the configured availability range.
      // This prevents cases where a start time exists but the chosen duration would exceed
      // the sitter's real end-of-availability window.
      const startMin = typeof (selectedSlot as any).startMin === "number" ? (selectedSlot as any).startMin : null;
      const endMin = typeof (selectedSlot as any).endMin === "number" ? (selectedSlot as any).endMin : null;
      const ranges = Array.isArray((daySlots as any).configuredRanges) ? ((daySlots as any).configuredRanges as any[]) : [];
      const configuredRange = Number.isFinite(startMin)
        ? ranges.find((r) => r && typeof r.startMin === "number" && typeof r.endMin === "number" && startMin >= r.startMin && startMin < r.endMin) ?? null
        : null;
      if (configuredRange && Number.isFinite(endMin) && typeof configuredRange.endMin === "number" && endMin > configuredRange.endMin) {
        return NextResponse.json(
          {
            ok: false,
            error: "DATE_NOT_AVAILABLE",
            message: "Ce créneau dépasse la plage de disponibilité du sitter. Choisis un autre horaire ou une durée plus courte.",
          },
          { status: 400 }
        );
      }
    }

    // Anti double-booking: backend source of truth.
    // Apply the same +/- 30 min safety buffer as the shared availability engine.
    const blockingStatuses = ["PENDING_ACCEPTANCE", "PAID", "CONFIRMED"] as const;
    const candidateWindowStart = withBuffer(startDateTime, -BOOKING_CONFLICT_BUFFER_MINUTES);
    const candidateWindowEnd = withBuffer(endDateTime, BOOKING_CONFLICT_BUFFER_MINUTES);
    const overlap = await (prisma as any).booking.findFirst({
      where: {
        sitterId,
        status: { in: blockingStatuses as any },
        startDate: { lt: candidateWindowEnd },
        endDate: { gt: candidateWindowStart },
      },
      select: { id: true, status: true, startDate: true, endDate: true },
    });
    if (overlap?.id && isConflictBlockingStatus(typeof overlap.status === "string" ? overlap.status : "")) {
      return NextResponse.json(
        {
          ok: false,
          error: "SLOT_NOT_AVAILABLE",
          message: "Ce créneau vient d’être réservé ou n’est plus disponible, merci de choisir un autre horaire.",
        },
        { status: 409 }
      );
    }

    const amount = toCents(totalChf);

    if (!Number.isFinite(amount) || amount < 100) {
      return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
    }

    const platformFeeAmount = Math.round(amount * DOGSHIFT_COMMISSION_RATE);

    const booking = await (prisma as any).booking.create({
      data: {
        userId,
        sitterId,
        service,
        startDate: startDateTime,
        endDate: endDateTime,
        message,
        status: "PENDING_PAYMENT",
        amount,
        currency: "chf",
        platformFeeAmount,
      },
      select: { id: true },
    });

    try {
      const db = prisma as any;
      await db.conversation.upsert({
        where: {
          ownerId_sitterId: {
            ownerId: userId,
            sitterId,
          },
        },
        create: {
          ownerId: userId,
          sitterId,
          bookingId: booking.id,
          lastMessageAt: null,
          lastMessagePreview: null,
        },
        update: {
          bookingId: booking.id,
        },
        select: { id: true },
      });
    } catch (err) {
      console.error("[api][bookings][POST] conversation upsert failed", err);
    }

    void logAudit({
      action: "booking.created",
      actorType: "user",
      actorId: userId,
      targetId: booking.id,
      targetType: "BOOKING",
      metadata: { service, amount, sitterId },
    });

    void recordBookingFinanceEvent({
      bookingId: booking.id,
      eventType: "BOOKING_CREATED",
      message: "Reservation creee.",
      payoutMethod: "STRIPE",
      payoutStatus: "PENDING",
      amount,
      currency: "chf",
      actorType: "SYSTEM",
      actorId: userId,
      metadata: { service, sitterId },
    });

    return NextResponse.json({ ok: true, bookingId: booking.id }, { status: 200 });
  } catch (err) {
    console.error("[api][bookings][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
