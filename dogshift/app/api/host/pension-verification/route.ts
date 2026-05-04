/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const db = prisma as any;
    const profile = await db.sitterProfile.findUnique({
      where: { userId },
      select: {
        sitterId: true,
        services: true,
        pricing: true,
        pensionVerifStatus: true,
        pensionPhotoUrls: true,
        pensionPhotoSubmittedAt: true,
        pensionAiScore: true,
        pensionAiVerdict: true,
        pensionAiReasoning: true,
        pensionAdminNotes: true,
      },
    });

    if (!profile) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    // Check if Pension is enabled via ServiceConfig (modern), pricing fallback, or legacy services JSON
    const serviceConfigs: { serviceType: string; enabled: boolean }[] = await prisma.serviceConfig.findMany({
      where: { sitterId: profile.sitterId },
      select: { serviceType: true, enabled: true },
    });

    let hasPension = false;
    if (serviceConfigs.length > 0) {
      hasPension = serviceConfigs.some((c) => c.serviceType === "PENSION" && c.enabled);
    } else {
      // Fallback: pricing or legacy services JSON
      const pricing = profile.pricing as Record<string, unknown> | null;
      const services = profile.services;
      hasPension =
        (pricing && typeof pricing.Pension === "number" && pricing.Pension > 0) ||
        (Array.isArray(services) && services.includes("Pension")) ||
        (services && typeof services === "object" && !Array.isArray(services) && Boolean((services as Record<string, unknown>).Pension));
    }

    return NextResponse.json({
      ok: true,
      hasPension,
      status: profile.pensionVerifStatus ?? "not_submitted",
      photoCount: Array.isArray(profile.pensionPhotoUrls) ? profile.pensionPhotoUrls.length : 0,
      submittedAt: profile.pensionPhotoSubmittedAt ?? null,
      aiScore: profile.pensionAiScore ?? null,
      aiVerdict: profile.pensionAiVerdict ?? null,
      aiReasoning: profile.pensionAiReasoning ?? null,
      adminNotes: profile.pensionAdminNotes ?? null,
    });
  } catch (err) {
    console.error("[api][host][pension-verification][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
