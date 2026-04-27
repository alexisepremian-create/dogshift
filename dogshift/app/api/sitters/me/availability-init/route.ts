import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSitterOwner } from "@/lib/auth/requireSitterOwner";
import { getUserPhone } from "@/lib/user/getUserPhone";
import { TIMEZONE_ZURICH, type ServiceType } from "@/lib/availability/slotEngine";
import { computeMultiDayStatusIndexed } from "@/lib/availability/dayStatusMulti";

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

function toZurichIsoDate(dt: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_ZURICH,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function pricingKeyForService(serviceType: ServiceType) {
  if (serviceType === "PROMENADE") return "Promenade";
  if (serviceType === "DOGSITTING") return "Garde";
  return "Pension";
}

const SERVICES: ServiceType[] = ["PROMENADE", "DOGSITTING", "PENSION"];

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();

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
    const [sitterProfile, user, allRules, allExceptions, allConfigs] = await Promise.all([
      prisma.sitterProfile.findUnique({
        where: { sitterId: auth.sitterId },
        select: { lastMinuteEnabled: true, pricing: true },
      }),
      prisma.user.findUnique({
        where: { id: auth.dbUserId },
        select: { id: true, phone: true, hostProfileJson: true },
      }),
      (prisma as any).availabilityRule.findMany({
        where: { sitterId: auth.sitterId },
        orderBy: [{ serviceType: "asc" }, { dayOfWeek: "asc" }, { startMin: "asc" }],
        select: { id: true, serviceType: true, dayOfWeek: true, startMin: true, endMin: true, status: true },
      }),
      (prisma as any).availabilityException.findMany({
        where: { sitterId: auth.sitterId, date: { gte: fromStart, lte: toEnd } },
        orderBy: [{ serviceType: "asc" }, { date: "asc" }, { startMin: "asc" }],
        select: { id: true, serviceType: true, date: true, startMin: true, endMin: true, status: true },
      }),
      (prisma as any).serviceConfig.findMany({
        where: { sitterId: auth.sitterId },
      }),
    ]);

    // Check which services have valid pricing
    const pricing = sitterProfile?.pricing && typeof sitterProfile.pricing === "object"
      ? (sitterProfile.pricing as Record<string, unknown>)
      : {};
    const pricingByService: Record<ServiceType, boolean> = {
      PROMENADE: typeof pricing[pricingKeyForService("PROMENADE")] === "number" && (pricing[pricingKeyForService("PROMENADE")] as number) > 0,
      DOGSITTING: typeof pricing[pricingKeyForService("DOGSITTING")] === "number" && (pricing[pricingKeyForService("DOGSITTING")] as number) > 0,
      PENSION: typeof pricing[pricingKeyForService("PENSION")] === "number" && (pricing[pricingKeyForService("PENSION")] as number) > 0,
    };

    // Normalize exceptions dates to ISO strings
    const normalizedExceptions = (allExceptions ?? []).map((e: any) => ({
      id: e.id,
      serviceType: e.serviceType,
      date: e.date instanceof Date ? toZurichIsoDate(e.date) : String(e.date ?? "").slice(0, 10),
      startMin: e.startMin,
      endMin: e.endMin,
      status: e.status,
    }));

    // Compute calendar day statuses (same logic as day-status/multi endpoint)
    const allBookings = await (prisma as any).booking.findMany({
      where: {
        sitterId: auth.sitterId,
        OR: [
          { startAt: { lt: toEnd }, endAt: { gt: fromStart } },
          { startDate: { lt: toEnd }, endDate: { gt: fromStart } },
        ],
      },
      select: { status: true, createdAt: true, startAt: true, endAt: true, startDate: true, endDate: true },
    });

    const computed = computeMultiDayStatusIndexed({
      sitterId: auth.sitterId,
      dates,
      now: new Date(),
      allRules: allRules ?? [],
      allExceptions: normalizedExceptions,
      allBookings: allBookings ?? [],
      allConfigs: allConfigs ?? [],
    });

    // Shape rules by service (empty if no pricing)
    const rulesByService: Record<ServiceType, any[]> = {
      PROMENADE: [],
      DOGSITTING: [],
      PENSION: [],
    };
    for (const rule of allRules ?? []) {
      const st = rule?.serviceType as ServiceType;
      if (SERVICES.includes(st) && pricingByService[st]) {
        rulesByService[st].push(rule);
      }
    }

    // Shape exceptions by service
    const exceptionsByService: Record<ServiceType, any[]> = {
      PROMENADE: [],
      DOGSITTING: [],
      PENSION: [],
    };
    for (const exc of normalizedExceptions) {
      const st = exc.serviceType as ServiceType;
      if (SERVICES.includes(st)) {
        exceptionsByService[st].push(exc);
      }
    }

    // Parse services selected during registration from hostProfileJson.
    // These are used as defaults when no serviceConfig DB record exists yet (new sitter).
    const hostProfileRaw: unknown = (() => {
      const raw = (user as any)?.hostProfileJson;
      if (typeof raw !== "string") return null;
      try { return JSON.parse(raw); } catch { return null; }
    })();
    const hostServices =
      hostProfileRaw && typeof hostProfileRaw === "object" && "services" in (hostProfileRaw as object) &&
      typeof (hostProfileRaw as any).services === "object"
        ? (hostProfileRaw as any).services as Record<string, unknown>
        : null;

    // Shape configs by service — DB records take precedence; fall back to what was
    // selected in the registration form (hostServices). Default to true only if
    // hostProfileJson is unavailable (legacy profiles).
    const configsByService: Record<ServiceType, { enabled: boolean }> = {
      PROMENADE: { enabled: hostServices ? Boolean(hostServices.Promenade) : true },
      DOGSITTING: { enabled: hostServices ? Boolean(hostServices.Garde) : true },
      PENSION: { enabled: hostServices ? Boolean(hostServices.Pension) : true },
    };
    for (const cfg of allConfigs ?? []) {
      const st = cfg?.serviceType as ServiceType;
      if (SERVICES.includes(st)) {
        configsByService[st] = { enabled: cfg.enabled ?? true };
      }
    }

    const phonePresent = Boolean(
      getUserPhone({ userId: auth.dbUserId, phone: (user as any)?.phone, hostProfileJson: (user as any)?.hostProfileJson })
    );

    const durationMs = Date.now() - startedAt;
    console.info("[api][sitters][me][availability-init][GET]", {
      sitterId: auth.sitterId,
      from,
      to,
      durationMs,
    });

    return NextResponse.json(
      {
        ok: true,
        lastMinuteEnabled: Boolean(sitterProfile?.lastMinuteEnabled),
        phonePresent,
        configs: configsByService,
        rules: rulesByService,
        exceptions: exceptionsByService,
        days: computed.days,
        pricingMissing: {
          PROMENADE: !pricingByService.PROMENADE,
          DOGSITTING: !pricingByService.DOGSITTING,
          PENSION: !pricingByService.PENSION,
        },
      },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "x-dogshift-duration": String(durationMs),
        },
      }
    );
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    console.error("[api][sitters][me][availability-init][GET] error", { sitterId: auth.sitterId, from, to, durationMs, err });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
