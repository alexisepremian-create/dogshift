import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { checkBoardingRange, TIMEZONE_ZURICH } from "@/lib/availability/slotEngine";

export const runtime = "nodejs";

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sitterId: string } | Promise<{ sitterId: string }> }
) {
  const startedAt = Date.now();
  const resolved = (await params) as { sitterId?: string };
  const sitterId = typeof resolved?.sitterId === "string" ? resolved.sitterId.trim() : "";

  const url = new URL(req.url);
  const start = (url.searchParams.get("start") ?? "").trim();
  const end = (url.searchParams.get("end") ?? "").trim();
  const dbg = url.searchParams.get("dbg") === "1";

  if (!sitterId) return NextResponse.json({ ok: false, error: "INVALID_SITTER" }, { status: 400 });
  if (!isValidIsoDate(start) || !isValidIsoDate(end)) {
    return NextResponse.json({ ok: false, error: "INVALID_RANGE" }, { status: 400 });
  }

  const result = await checkBoardingRange({ sitterId, startDate: start, endDate: end });
  const durationMs = Date.now() - startedAt;

  if (dbg) {
    console.log("[api][sitters][boarding-status][GET]", {
      sitterId,
      start,
      end,
      ok: result.ok,
      durationMs,
    });
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
          ...(dbg ? { "x-dogshift-boarding-status": "1" } : {}),
        },
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      timezone: TIMEZONE_ZURICH,
      ...result.result,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        ...(dbg ? { "x-dogshift-boarding-status": "1" } : {}),
      },
    }
  );
}
