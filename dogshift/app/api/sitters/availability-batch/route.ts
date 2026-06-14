/**
 * POST /api/sitters/availability-batch
 *
 * Batch availability check for the search page: given a service + date(s) and a
 * list of sitterIds, returns each sitter's availability status so the client can
 * filter the results to sitters actually free on those dates.
 *
 * Body:
 *   { service: "Promenade"|"Garde"|"Pension", sitterIds: string[],
 *     date?: "YYYY-MM-DD", duration?: "2h30",        // Promenade/Garde
 *     arrival?: "YYYY-MM-DD", departure?: "YYYY-MM-DD" } // Pension
 *
 * Response: { ok: true, statuses: { [sitterId]: "AVAILABLE"|"ON_REQUEST"|"UNAVAILABLE" } }
 *
 * Public (sits under /api/sitters/, not behind the auth middleware). Reuses the
 * per-sitter availability engine; runs with bounded concurrency (~10-50 pilot
 * sitters → a single request is fine).
 */
import { NextResponse } from "next/server";

import { generateDaySlots, checkBoardingRange } from "@/lib/availability/slotEngine";
import { summarizeDayStatusFromSlots } from "@/lib/availability/dayStatus";
import { serviceLabelToEnum, parseDurationToMin } from "@/lib/search/serviceAndDuration";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";

type DayStatus = "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const serviceType = serviceLabelToEnum(typeof b.service === "string" ? b.service : null);
  const sitterIds = Array.isArray(b.sitterIds)
    ? b.sitterIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];

  if (!serviceType) {
    return NextResponse.json({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });
  }
  if (sitterIds.length === 0) {
    return NextResponse.json({ ok: true, statuses: {} });
  }
  if (sitterIds.length > 200) {
    return NextResponse.json({ ok: false, error: "TOO_MANY_SITTERS" }, { status: 400 });
  }

  const date = typeof b.date === "string" ? b.date.trim() : "";
  const duration = typeof b.duration === "string" ? b.duration : "";
  const arrival = typeof b.arrival === "string" ? b.arrival.trim() : "";
  const departure = typeof b.departure === "string" ? b.departure.trim() : "";

  try {
    let statusFor: (sitterId: string) => Promise<DayStatus>;

    if (serviceType === "PENSION") {
      if (!ISO_DATE.test(arrival) || !ISO_DATE.test(departure)) {
        return NextResponse.json({ ok: false, error: "INVALID_RANGE" }, { status: 400 });
      }
      statusFor = async (sitterId) => {
        const res = await checkBoardingRange({ sitterId, startDate: arrival, endDate: departure });
        return res.ok ? (res.result.status as DayStatus) : "UNAVAILABLE";
      };
    } else {
      if (!ISO_DATE.test(date)) {
        return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
      }
      const durationMin = parseDurationToMin(duration) ?? undefined;
      statusFor = async (sitterId) => {
        const res = await generateDaySlots({ sitterId, serviceType, date, durationMin });
        if (!res.ok) return "UNAVAILABLE";
        return summarizeDayStatusFromSlots(res.slots) as DayStatus;
      };
    }

    const statusesList = await mapWithConcurrency(sitterIds, 8, async (sitterId) => {
      try {
        return { sitterId, status: await statusFor(sitterId) };
      } catch {
        return { sitterId, status: "UNAVAILABLE" as DayStatus };
      }
    });

    const statuses: Record<string, DayStatus> = {};
    for (const { sitterId, status } of statusesList) statuses[sitterId] = status;

    return NextResponse.json({ ok: true, statuses }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "AVAILABILITY_BATCH_FAILED",
      route: "sitters.availability-batch",
      extra: { message: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
