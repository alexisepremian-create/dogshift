/**
 * POST /api/host/dismiss-banner  { banner: "accountActivated" | "completionCard" }
 *
 * Persists a permanent dismissal of a sitter dashboard onboarding banner into
 * User.hostProfileJson, so it never reappears after the sitter closes it
 * (localStorage was not durable enough). Session-gated (under /api/host/).
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { applyBannerDismissal } from "@/lib/hostBannerDismissal";
import { reportApiError } from "@/lib/observability/reportApiError";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const BodySchema = z.object({ banner: z.enum(["accountActivated", "completionCard"]) });

export async function POST(req: Request) {
  try {
    const user = await getAuthedDbUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR" }, { status: 400 });
    }

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { hostProfileJson: true },
    });
    const nextJson = applyBannerDismissal(
      (row as { hostProfileJson?: string | null } | null)?.hostProfileJson ?? null,
      parsed.data.banner,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { hostProfileJson: nextJson } as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "DISMISS_BANNER_FAILED",
      route: "api/host/dismiss-banner",
      extra: { message: String(err) },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
