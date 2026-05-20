/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/native/register-push-token
 *
 * Called by the Capacitor app once @capacitor/push-notifications successfully
 * registers with APNs (iOS) or FCM (Android) and receives a device token.
 *
 * Body : { platform: "ios" | "android", token: string, bundleId?: string }
 *
 * The endpoint is idempotent — re-registering the same token just bumps
 * updatedAt. Different users registering the same token (e.g. account switch)
 * re-points it to the new user.
 *
 * NOTE : this route lives under /api/native/ rather than /api/account/ so it
 * isn't subject to the cookie-only middleware gate. Auth is enforced inline.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";

const bodySchema = z.object({
  platform: z.enum(["ios", "android"]),
  token: z.string().min(8).max(4096),
  bundleId: z.string().min(1).max(256).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", details: parsed.error.message },
        { status: 400 },
      );
    }

    const { platform, token, bundleId } = parsed.data;

    // Upsert by unique `token` — handles re-registration AND account switching.
    await (prisma as any).nativePushToken.upsert({
      where: { token },
      update: {
        userId: user.id,
        platform,
        bundleId: bundleId ?? null,
        invalidatedAt: null,
      },
      create: {
        userId: user.id,
        platform,
        token,
        bundleId: bundleId ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { message?: string; code?: string };
    console.error("[api][native][register-push-token] error", JSON.stringify({ code: e?.code, message: e?.message }));
    reportApiError({
      kind: "internal_error",
      code: "NATIVE_PUSH_REGISTER_FAILED",
      route: "/api/native/register-push-token",
      extra: { error: String(err) },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
