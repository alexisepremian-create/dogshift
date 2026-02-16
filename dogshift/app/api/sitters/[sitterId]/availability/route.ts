import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

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

export async function GET(
  req: NextRequest,
  { params }: { params: { sitterId: string } | Promise<{ sitterId: string }> }
) {
  const startedAt = Date.now();
  const requestId = typeof (globalThis as any).crypto?.randomUUID === "function" ? (globalThis as any).crypto.randomUUID() : `r_${startedAt}`;
  console.info("[api][sitters][id][availability][GET] start", { requestId });
  try {
    const resolved = (await params) as { sitterId?: string };
    const sitterId = typeof resolved?.sitterId === "string" ? resolved.sitterId.trim() : "";
    if (!isValidSitterId(sitterId)) {
      return NextResponse.json({ ok: false, error: "INVALID_SITTER" }, { status: 400 });
    }

    const todayIso = todayZurichIsoDate();

    const rows = await withTimeout<any[]>(
      (prisma as any).availability.findMany({
        where: {
          sitterId,
          isAvailable: true,
          dateKey: { gte: todayIso },
        },
        orderBy: { dateKey: "asc" },
        select: { dateKey: true },
      }),
      12_000,
      "availability.findMany"
    );

    const dates = (rows ?? [])
      .map((r: any) => (typeof r?.dateKey === "string" ? r.dateKey : null))
      .filter((d: any): d is string => typeof d === "string" && d.trim().length > 0);

    return NextResponse.json({ ok: true, dates }, { status: 200 });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = typeof message === "string" && message.startsWith("TIMEOUT:");
    console.error("[api][sitters][id][availability][GET] error", { requestId, durationMs, err });
    if (isTimeout) return NextResponse.json({ ok: false, error: "TIMEOUT" }, { status: 504 });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    const durationMs = Date.now() - startedAt;
    console.info("[api][sitters][id][availability][GET] end", { requestId, durationMs });
  }
}
