/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as { endpoint?: string };
    if (!body.endpoint) {
      reportApiError({ kind: "validation_error", code: "MISSING_ENDPOINT", route: "push.unsubscribe" });
      return NextResponse.json({ ok: false, error: "MISSING_ENDPOINT" }, { status: 400 });
    }

    await (prisma as any).pushSubscription.deleteMany({
      where: { endpoint: body.endpoint, userId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][push][unsubscribe][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
