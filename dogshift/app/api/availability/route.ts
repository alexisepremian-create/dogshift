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

type BulkBody = {
  added?: unknown;
  removed?: unknown;
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

function normalizeDateKeys(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  const out: string[] = [];
  for (const v of value) {
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

export async function PUT(req: NextRequest) {
  const startedAt = Date.now();
  const requestId = typeof (globalThis as any).crypto?.randomUUID === "function" ? (globalThis as any).crypto.randomUUID() : `r_${startedAt}`;
  console.info("[api][availability][PUT] start", { requestId });
  try {
    const auth = await requireSitterUser(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    let body: BulkBody;
    try {
      body = (await req.json()) as BulkBody;
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const added = normalizeDateKeys((body as any)?.added);
    const removed = normalizeDateKeys((body as any)?.removed);

    if (added.length === 0 && removed.length === 0) {
      return NextResponse.json({ ok: true, created: 0, deleted: 0 }, { status: 200 });
    }

    const todayIso = todayZurichIsoDate();

    for (const k of added) {
      if (!isValidIsoDate(k)) return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      if (k < todayIso) return NextResponse.json({ ok: false, error: "PAST_DATE" }, { status: 400 });
    }

    for (const k of removed) {
      if (!isValidIsoDate(k)) return NextResponse.json({ ok: false, error: "INVALID_DATES" }, { status: 400 });
      if (k < todayIso) return NextResponse.json({ ok: false, error: "PAST_DATE" }, { status: 400 });
    }

    const toCreate = added.filter((k) => !removed.includes(k));
    const toDelete = removed.filter((k) => !added.includes(k));

    const result = await withTimeout<{ created: number; deleted: number }>(
      (prisma as any).$transaction(async (tx: any) => {
        let created = 0;
        let deleted = 0;

        if (toCreate.length) {
          const createRes = await tx.availability.createMany({
            data: toCreate.map((dateKey) => ({ sitterId: auth.sitterId, dateKey, isAvailable: true })),
            skipDuplicates: true,
          });
          created = typeof createRes?.count === "number" ? createRes.count : 0;
        }

        if (toDelete.length) {
          const delRes = await tx.availability.deleteMany({
            where: { sitterId: auth.sitterId, dateKey: { in: toDelete } },
          });
          deleted = typeof delRes?.count === "number" ? delRes.count : 0;
        }

        return { created, deleted };
      }),
      12_000,
      "prisma.$transaction"
    );

    const durationMs = Date.now() - startedAt;
    console.info("[api][availability][PUT]", {
      requestId,
      sitterId: auth.sitterId,
      added: added.length,
      removed: removed.length,
      created: result.created,
      deleted: result.deleted,
      durationMs,
    });

    return NextResponse.json({ ok: true, created: result.created, deleted: result.deleted }, { status: 200 });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = typeof message === "string" && message.startsWith("TIMEOUT:");
    console.error("[api][availability][PUT] error", { requestId, durationMs, err });
    if (isTimeout) {
      return NextResponse.json({ ok: false, error: "TIMEOUT" }, { status: 504 });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    const durationMs = Date.now() - startedAt;
    console.info("[api][availability][PUT] end", { requestId, durationMs });
  }
}
