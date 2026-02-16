import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (t) clearTimeout(t);
  }) as Promise<T>;
}

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
  const userId = await withTimeout(resolveDbUserId(req), 8_000, "resolveDbUserId");
  if (!userId) return { ok: false as const, status: 401 as const, error: "UNAUTHORIZED" };

  const user = await withTimeout<any>(
    (prisma as any).user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, sitterId: true },
    }),
    8_000,
    "user.findUnique"
  );

  const sitterId = typeof user?.sitterId === "string" ? user.sitterId : null;
  if (!user?.id || user.role !== "SITTER" || !sitterId) {
    return { ok: false as const, status: 403 as const, error: "FORBIDDEN" };
  }

  return { ok: true as const, userId, sitterId };
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const requestId = typeof (globalThis as any).crypto?.randomUUID === "function" ? (globalThis as any).crypto.randomUUID() : `r_${startedAt}`;
  console.info("[api][sitter][availability][GET] start", { requestId });
  try {
    const auth = await requireSitterUser(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const rows = await withTimeout<any[]>(
      (prisma as any).availability.findMany({
        where: { sitterId: auth.sitterId },
        orderBy: { dateKey: "asc" },
        select: { dateKey: true, isAvailable: true },
      }),
      12_000,
      "availability.findMany"
    );

    const dates = (rows ?? [])
      .filter((r: any) => r?.isAvailable)
      .map((r: any) => (typeof r?.dateKey === "string" ? r.dateKey : null))
      .filter((d: any): d is string => typeof d === "string" && d.trim().length > 0);

    return NextResponse.json({ ok: true, dates }, { status: 200 });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = typeof message === "string" && message.startsWith("TIMEOUT:");
    console.error("[api][sitter][availability][GET] error", { requestId, durationMs, err });
    if (isTimeout) return NextResponse.json({ ok: false, error: "TIMEOUT" }, { status: 504 });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    const durationMs = Date.now() - startedAt;
    console.info("[api][sitter][availability][GET] end", { requestId, durationMs });
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const requestId = typeof (globalThis as any).crypto?.randomUUID === "function" ? (globalThis as any).crypto.randomUUID() : `r_${startedAt}`;
  console.info("[api][sitter][availability][POST] start", { requestId });
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
    for (const iso of dates) {
      if (!isValidIsoDate(iso)) return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      if (iso < todayIso) return NextResponse.json({ ok: false, error: "PAST_DATE" }, { status: 400 });
    }

    await withTimeout(
      (prisma as any).availability.createMany({
        data: dates.map((dateKey) => ({ sitterId: auth.sitterId, dateKey, isAvailable: true })),
        skipDuplicates: true,
      }),
      12_000,
      "availability.createMany"
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = typeof message === "string" && message.startsWith("TIMEOUT:");
    console.error("[api][sitter][availability][POST] error", { requestId, durationMs, err });
    if (isTimeout) return NextResponse.json({ ok: false, error: "TIMEOUT" }, { status: 504 });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    const durationMs = Date.now() - startedAt;
    console.info("[api][sitter][availability][POST] end", { requestId, durationMs });
  }
}

export async function DELETE(req: NextRequest) {
  const startedAt = Date.now();
  const requestId = typeof (globalThis as any).crypto?.randomUUID === "function" ? (globalThis as any).crypto.randomUUID() : `r_${startedAt}`;
  console.info("[api][sitter][availability][DELETE] start", { requestId });
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
    for (const iso of dates) {
      if (!isValidIsoDate(iso)) return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      if (iso < todayIso) return NextResponse.json({ ok: false, error: "PAST_DATE" }, { status: 400 });
    }

    await withTimeout(
      (prisma as any).availability.deleteMany({
        where: {
          sitterId: auth.sitterId,
          dateKey: { in: dates },
        },
      }),
      12_000,
      "availability.deleteMany"
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = typeof message === "string" && message.startsWith("TIMEOUT:");
    console.error("[api][sitter][availability][DELETE] error", { requestId, durationMs, err });
    if (isTimeout) return NextResponse.json({ ok: false, error: "TIMEOUT" }, { status: 504 });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    const durationMs = Date.now() - startedAt;
    console.info("[api][sitter][availability][DELETE] end", { requestId, durationMs });
  }
}
