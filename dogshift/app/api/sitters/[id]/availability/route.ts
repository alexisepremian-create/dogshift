import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isValidSitterId(value: string) {
  return Boolean(value && value.trim());
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

export async function GET(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const resolved = (await params) as { id?: string };
    const sitterId = typeof resolved?.id === "string" ? resolved.id.trim() : "";
    if (!isValidSitterId(sitterId)) {
      return NextResponse.json({ ok: false, error: "INVALID_SITTER" }, { status: 400 });
    }

    const todayIso = todayZurichIsoDate();
    const floor = isoDateToUtcMidnight(todayIso);
    if (!floor) {
      return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
    }

    const rows = await (prisma as any).availability.findMany({
      where: {
        sitterId,
        isAvailable: true,
        date: { gte: floor },
      },
      orderBy: { date: "asc" },
      select: { date: true },
    });

    const dates = (rows ?? [])
      .map((r: any) => {
        const dt = r?.date instanceof Date ? r.date : new Date(r?.date);
        return dt instanceof Date && !Number.isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : null;
      })
      .filter((d: any): d is string => typeof d === "string");

    return NextResponse.json({ ok: true, dates }, { status: 200 });
  } catch (err) {
    console.error("[api][sitters][id][availability][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
