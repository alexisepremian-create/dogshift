import { NextResponse } from "next/server";

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

export async function GET() {
  const startedAt = Date.now();
  const requestId = typeof (globalThis as any).crypto?.randomUUID === "function" ? (globalThis as any).crypto.randomUUID() : `r_${startedAt}`;
  console.info("[api][health][GET] start", { requestId });

  try {
    await withTimeout((prisma as any).$queryRaw`SELECT 1`, 5_000, "db.SELECT_1");
    const durationMs = Date.now() - startedAt;
    console.info("[api][health][GET] ok", { requestId, durationMs });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = typeof message === "string" && message.startsWith("TIMEOUT:");
    console.error("[api][health][GET] error", { requestId, durationMs, err });
    return NextResponse.json(
      {
        ok: false,
        error: isTimeout ? "DB_TIMEOUT" : "DB_UNREACHABLE",
      },
      { status: isTimeout ? 504 : 500 }
    );
  } finally {
    const durationMs = Date.now() - startedAt;
    console.info("[api][health][GET] end", { requestId, durationMs });
  }
}
