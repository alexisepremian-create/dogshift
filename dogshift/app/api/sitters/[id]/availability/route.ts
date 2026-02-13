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

export async function GET(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const resolved = (await params) as { id?: string };
    const sitterId = typeof resolved?.id === "string" ? resolved.id.trim() : "";
    if (!isValidSitterId(sitterId)) {
      return NextResponse.json({ ok: false, error: "INVALID_SITTER" }, { status: 400 });
    }

    const todayIso = todayZurichIsoDate();

    const rows = await (prisma as any).availability.findMany({
      where: {
        sitterId,
        isAvailable: true,
        dateKey: { gte: todayIso },
      },
      orderBy: { dateKey: "asc" },
      select: { dateKey: true },
    });

    const dates = (rows ?? [])
      .map((r: any) => (typeof r?.dateKey === "string" ? r.dateKey : null))
      .filter((d: any): d is string => typeof d === "string" && d.trim().length > 0);

    return NextResponse.json({ ok: true, dates }, { status: 200 });
  } catch (err) {
    console.error("[api][sitters][id][availability][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
