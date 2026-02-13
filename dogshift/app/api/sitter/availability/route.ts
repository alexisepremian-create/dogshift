import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

type DatesBody = {
  dates?: unknown;
};

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function normalizeDatesBody(body: DatesBody) {
  const raw = (body as any)?.dates;
  if (!Array.isArray(raw)) return [] as string[];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return Array.from(new Set(out));
}

async function requireSitterUser(req: NextRequest) {
  const userId = await resolveDbUserId(req);
  if (!userId) return { ok: false as const, status: 401 as const, error: "UNAUTHORIZED" };

  const user = await (prisma as any).user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, sitterId: true },
  });

  const sitterId = typeof user?.sitterId === "string" ? user.sitterId : null;
  if (!user?.id || user.role !== "SITTER" || !sitterId) {
    return { ok: false as const, status: 403 as const, error: "FORBIDDEN" };
  }

  return { ok: true as const, userId, sitterId };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSitterUser(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const rows = await (prisma as any).availability.findMany({
      where: { sitterId: auth.sitterId },
      orderBy: { date: "asc" },
      select: { date: true, isAvailable: true },
    });

    const dates = (rows ?? [])
      .filter((r: any) => r?.isAvailable)
      .map((r: any) => {
        const dt = r?.date instanceof Date ? r.date : new Date(r?.date);
        return dt instanceof Date && !Number.isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : null;
      })
      .filter((d: any): d is string => typeof d === "string");

    return NextResponse.json({ ok: true, dates }, { status: 200 });
  } catch (err) {
    console.error("[api][sitter][availability][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSitterUser(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    let body: DatesBody;
    try {
      body = (await req.json()) as DatesBody;
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const dates = normalizeDatesBody(body);
    if (dates.length === 0) {
      return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
    }

    const todayIso = todayZurichIsoDate();
    const normalized: Array<{ iso: string; date: Date }> = [];
    for (const iso of dates) {
      if (!isValidIsoDate(iso)) return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      if (iso < todayIso) return NextResponse.json({ ok: false, error: "PAST_DATE" }, { status: 400 });
      const dt = isoDateToUtcMidnight(iso);
      if (!dt) return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      normalized.push({ iso, date: dt });
    }

    await (prisma as any).$transaction(
      normalized.map((d) =>
        (prisma as any).availability.upsert({
          where: { sitterId_date: { sitterId: auth.sitterId, date: d.date } },
          create: { sitterId: auth.sitterId, date: d.date, isAvailable: true },
          update: { isAvailable: true },
          select: { id: true },
        })
      )
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api][sitter][availability][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireSitterUser(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    let body: DatesBody;
    try {
      body = (await req.json()) as DatesBody;
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const dates = normalizeDatesBody(body);
    if (dates.length === 0) {
      return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
    }

    const todayIso = todayZurichIsoDate();
    const dateObjs: Date[] = [];
    for (const iso of dates) {
      if (!isValidIsoDate(iso)) return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      if (iso < todayIso) return NextResponse.json({ ok: false, error: "PAST_DATE" }, { status: 400 });
      const dt = isoDateToUtcMidnight(iso);
      if (!dt) return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      dateObjs.push(dt);
    }

    await (prisma as any).availability.deleteMany({
      where: {
        sitterId: auth.sitterId,
        date: { in: dateObjs },
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api][sitter][availability][DELETE] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
