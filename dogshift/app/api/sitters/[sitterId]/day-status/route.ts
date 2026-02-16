import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { generateDaySlots, TIMEZONE_ZURICH, type ServiceType } from "@/lib/availability/slotEngine";
import { summarizeDayStatusFromSlots } from "@/lib/availability/dayStatus";

export const runtime = "nodejs";

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeService(value: string): ServiceType | null {
  const v = value.trim().toUpperCase();
  if (v === "PROMENADE" || v === "DOGSITTING" || v === "PENSION") return v;
  return null;
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

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;

  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    for (;;) {
      const i = idx;
      idx += 1;
      if (i >= items.length) return;
      out[i] = await worker(items[i]);
    }
  });

  await Promise.all(runners);
  return out;
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
  const serviceRaw = (url.searchParams.get("service") ?? "").trim();
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

  const serviceType = serviceRaw ? normalizeService(serviceRaw) : ("PROMENADE" as const);
  if (!serviceType) return NextResponse.json({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });

  const dates: string[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDaysUtc(d, 1)) {
    dates.push(dateToIso(d));
    if (dates.length > 62) {
      return NextResponse.json({ ok: false, error: "RANGE_TOO_LARGE" }, { status: 400 });
    }
  }

  try {
    const days = await mapWithConcurrency(
      dates,
      5,
      async (date) => {
        const slotsRes = await generateDaySlots({ sitterId, serviceType, date });
        if (!slotsRes.ok) {
          return { date, status: "UNAVAILABLE" as const };
        }
        const status = summarizeDayStatusFromSlots(slotsRes.slots);
        return { date, status };
      }
    );

    const durationMs = Date.now() - startedAt;
    if (dbg) {
      console.log("[api][sitters][day-status][GET]", {
        sitterId,
        serviceType,
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
          ...(dbg ? { "x-dogshift-day-status": "1" } : {}),
        },
      }
    );
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    if (dbg) console.error("[api][sitters][day-status][GET] error", { sitterId, serviceType, from, to, durationMs, err });
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
          ...(dbg ? { "x-dogshift-day-status": "1" } : {}),
        },
      }
    );
  }
}
