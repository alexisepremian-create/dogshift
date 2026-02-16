import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  SERVICE_DEFAULTS,
  computeDaySlots,
  dayOfWeekForZurichDate,
  TIMEZONE_ZURICH,
  type ServiceType,
} from "@/lib/availability/slotEngine";
import { summarizeDayStatusFromSlots } from "@/lib/availability/dayStatus";

export const runtime = "nodejs";

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoToUtcMidnight(iso: string) {
  const [y, m, d] = iso.split("-").map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function addDaysUtc(dt: Date, deltaDays: number) {
  return new Date(dt.getTime() + deltaDays * 24 * 60 * 60 * 1000);
}

function dateToIso(dt: Date) {
  return dt.toISOString().slice(0, 10);
}

function ensureServiceConfig(sitterId: string, serviceType: ServiceType, row: any) {
  const defaults = SERVICE_DEFAULTS[serviceType];
  return {
    ...defaults,
    sitterId,
    ...(row ?? {}),
    serviceType,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sitterId: string } | Promise<{ sitterId: string }> }
) {
  const startedAt = Date.now();
  const resolved = (await params) as { sitterId?: string };
  const sitterId = typeof resolved?.sitterId === "string" ? resolved.sitterId.trim() : "";

  const url = new URL(req.url);
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const dbg = url.searchParams.get("dbg") === "1";

  if (!sitterId) return NextResponse.json({ ok: false, error: "INVALID_SITTER" }, { status: 400 });
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
    return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  const start = isoToUtcMidnight(from);
  const end = isoToUtcMidnight(to);
  if (!start || !end || end.getTime() < start.getTime()) {
    return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  const dates: string[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDaysUtc(d, 1)) {
    dates.push(dateToIso(d));
    if (dates.length > 62) {
      return NextResponse.json({ ok: false, error: "RANGE_TOO_LARGE" }, { status: 400 });
    }
  }

  const fromStart = new Date(`${from}T00:00:00.000Z`);
  const toEnd = new Date(`${to}T23:59:59.999Z`);

  try {
    const [allRules, allExceptions, allBookings, allConfigs] = await Promise.all([
      (prisma as any).availabilityRule.findMany({ where: { sitterId } }),
      (prisma as any).availabilityException.findMany({ where: { sitterId, date: { gte: from, lte: to } } }),
      (prisma as any).booking.findMany({
        where: {
          sitterId,
          startAt: { lt: toEnd },
          endAt: { gt: fromStart },
        },
      }),
      (prisma as any).serviceConfig.findMany({ where: { sitterId } }),
    ]);

    const configByService = new Map<ServiceType, any>();
    for (const row of allConfigs ?? []) {
      if (!row || typeof row.serviceType !== "string") continue;
      const st = row.serviceType as ServiceType;
      if (st === "PROMENADE" || st === "DOGSITTING" || st === "PENSION") {
        configByService.set(st, ensureServiceConfig(sitterId, st, row));
      }
    }

    const days = dates.map((date) => {
      const dow = dayOfWeekForZurichDate(date);

      const computeStatus = (serviceType: ServiceType) => {
        const rules = (allRules ?? []).filter((r: any) => r && r.serviceType === serviceType && r.dayOfWeek === dow);
        const exceptions = (allExceptions ?? []).filter((e: any) => e && e.serviceType === serviceType && e.date === date);
        const config = configByService.get(serviceType) ?? ensureServiceConfig(sitterId, serviceType, null);
        const slots = computeDaySlots({
          serviceType,
          date,
          now: new Date(),
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

    const durationMs = Date.now() - startedAt;
    if (dbg) {
      console.log("[api][sitters][day-status][multi][GET]", {
        sitterId,
        from,
        to,
        days: days.length,
        durationMs,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        timezone: TIMEZONE_ZURICH,
        days,
      },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
          ...(dbg ? { "x-dogshift-day-status-multi": "1" } : {}),
        },
      }
    );
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    if (dbg) console.error("[api][sitters][day-status][multi][GET] error", { sitterId, from, to, durationMs, err });
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
          ...(dbg ? { "x-dogshift-day-status-multi": "1" } : {}),
        },
      }
    );
  }
}
