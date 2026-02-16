import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { generateDaySlots, TIMEZONE_ZURICH, type ServiceType } from "@/lib/availability/slotEngine";

export const runtime = "nodejs";

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeService(value: string): ServiceType | null {
  const v = value.trim().toUpperCase();
  if (v === "PROMENADE" || v === "DOGSITTING" || v === "PENSION") return v;
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sitterId: string } | Promise<{ sitterId: string }> }
) {
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

  const result = await generateDaySlots({ sitterId, serviceType, date, durationMin: durationMin ?? undefined });
  const durationMs = Date.now() - startedAt;

  if (dbg) {
    console.log("[api][sitters][slots][GET]", {
      sitterId,
      serviceType,
      date,
      ok: result.ok,
      slots: result.ok ? result.slots.length : null,
      durationMs,
    });
  }

  if (!result.ok) {
    if (result.error === "INVALID_DURATION") {
      return NextResponse.json(
        { ok: false, error: result.error },
        {
          status: 400,
          headers: {
            "cache-control": "no-store",
            ...(dbg ? { "x-dogshift-slots": "1" } : {}),
          },
        }
      );
    }
    return NextResponse.json(
      { ok: false, error: result.error },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
          ...(dbg ? { "x-dogshift-slots": "1" } : {}),
        },
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      sitterId,
      serviceType,
      date,
      timezone: TIMEZONE_ZURICH,
      config: result.config,
      durationMin: result.durationMin,
      slots: result.slots,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        ...(dbg ? { "x-dogshift-slots": "1" } : {}),
      },
    }
  );
}
