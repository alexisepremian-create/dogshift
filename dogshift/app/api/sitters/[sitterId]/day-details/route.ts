import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { generateDaySlots, TIMEZONE_ZURICH, type ServiceType } from "@/lib/availability/slotEngine";
import { summarizeDayStatusFromSlots } from "@/lib/availability/dayStatus";
import { BUCKET_LABELS_FR, mapReasonToBucket, type ReasonBucketKey } from "@/lib/availability/reasonBuckets";

export const runtime = "nodejs";

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeService(value: string): ServiceType | null {
  const v = value.trim().toUpperCase();
  if (v === "PROMENADE" || v === "DOGSITTING" || v === "PENSION") return v;
  return null;
}

type BucketItem = { key: ReasonBucketKey; label: string; count: number };

type DayDetailsOk = {
  ok: true;
  sitterId: string;
  date: string;
  serviceType: ServiceType;
  timezone: string;
  status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
  summary: {
    availableCount: number;
    onRequestCount: number;
    unavailableCount: number;
  };
  buckets: BucketItem[];
  dbg?: {
    topReasons?: Array<{ reason: string; count: number }>;
  };
};

export async function GET(req: NextRequest, { params }: { params: { sitterId: string } | Promise<{ sitterId: string }> }) {
  const startedAt = Date.now();
  const resolved = (await params) as { sitterId?: string };
  const sitterId = typeof resolved?.sitterId === "string" ? resolved.sitterId.trim() : "";

  const url = new URL(req.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  const serviceRaw = (url.searchParams.get("service") ?? "").trim();
  const durationRaw = (url.searchParams.get("durationMin") ?? "").trim();
  const dbg = url.searchParams.get("dbg") === "1";

  if (!sitterId) {
    return NextResponse.json({ ok: false, error: "INVALID_SITTER" }, { status: 400 });
  }
  if (!isValidIsoDate(date)) {
    return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });
  }

  const serviceType = normalizeService(serviceRaw);
  if (!serviceType) {
    return NextResponse.json({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });
  }

  const durationMin = durationRaw ? Number(durationRaw) : null;
  if (durationMin !== null && !Number.isFinite(durationMin)) {
    return NextResponse.json({ ok: false, error: "INVALID_DURATION" }, { status: 400 });
  }

  const result = await generateDaySlots({
    sitterId,
    serviceType,
    date,
    durationMin: durationMin ?? undefined,
  });

  if (!result.ok) {
    const status = result.error === "INVALID_DURATION" ? 400 : 500;
    return NextResponse.json(
      { ok: false, error: result.error },
      {
        status,
        headers: {
          "cache-control": "no-store",
          ...(dbg ? { "x-dogshift-day-details": "1" } : {}),
        },
      }
    );
  }

  const slots = result.slots;
  const status = summarizeDayStatusFromSlots(slots);

  let availableCount = 0;
  let onRequestCount = 0;
  let unavailableCount = 0;

  const bucketCounts: Record<ReasonBucketKey, number> = {
    booking_existing: 0,
    booking_pending: 0,
    exception: 0,
    rules: 0,
    lead_time: 0,
    outside_hours: 0,
    other: 0,
  };

  const reasonCounts = new Map<string, number>();

  for (const s of slots) {
    if (!s) continue;
    if (s.status === "AVAILABLE") {
      availableCount += 1;
      continue;
    }
    if (s.status === "ON_REQUEST") {
      onRequestCount += 1;
    } else {
      unavailableCount += 1;
    }

    const bucket = mapReasonToBucket(s.reason);
    bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;

    if (dbg) {
      const key = typeof s.reason === "string" && s.reason ? s.reason : "(none)";
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
  }

  const buckets: BucketItem[] = (Object.keys(bucketCounts) as ReasonBucketKey[])
    .map((key) => ({ key, label: BUCKET_LABELS_FR[key], count: bucketCounts[key] ?? 0 }))
    .filter((b) => b.count > 0);

  const payload: DayDetailsOk = {
    ok: true,
    sitterId,
    date,
    serviceType,
    timezone: TIMEZONE_ZURICH,
    status,
    summary: {
      availableCount,
      onRequestCount,
      unavailableCount,
    },
    buckets,
  };

  if (dbg) {
    const topReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    payload.dbg = { topReasons };

    const durationMs = Date.now() - startedAt;
    console.log("[api][sitters][day-details][GET]", {
      sitterId,
      serviceType,
      date,
      durationMin: result.durationMin,
      status,
      buckets: buckets.length,
      durationMs,
    });
  }

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      ...(dbg ? { "x-dogshift-day-details": "1" } : {}),
    },
  });
}
