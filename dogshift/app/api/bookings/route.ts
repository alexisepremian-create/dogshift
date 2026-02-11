import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { DOGSHIFT_COMMISSION_RATE } from "@/lib/commission";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

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

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][bookings][POST] UNAUTHORIZED");
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as CreateBookingBody;
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

    const isDailyService = service === "Pension";

    let totalChf: number | null = null;
    let startDateTime: Date | null = null;
    let endDateTime: Date | null = null;

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
      if (!hasDailyDates) {
        return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      }
      totalChf = unit;
      startDateTime = new Date(`${startDate}T00:00:00Z`);
      endDateTime = new Date(`${endDate}T00:00:00Z`);
    }

    if (totalChf === null) {
      return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
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

    return NextResponse.json({ ok: true, bookingId: booking.id }, { status: 200 });
  } catch (err) {
    console.error("[api][bookings][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
