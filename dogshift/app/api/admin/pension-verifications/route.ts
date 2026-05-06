/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const db = prisma as any;
    const rows = await db.sitterProfile.findMany({
      where: {
        pensionVerifStatus: { in: ["pending", "ai_reviewing", "ai_needs_review", "ai_approved", "ai_rejected", "approved", "rejected", "legacy_pending"] },
      },
      orderBy: { pensionPhotoSubmittedAt: "desc" },
      select: {
        id: true,
        sitterId: true,
        displayName: true,
        city: true,
        postalCode: true,
        pensionVerifStatus: true,
        pensionPhotoUrls: true,
        pensionPhotoSubmittedAt: true,
        pensionPhotoReviewedAt: true,
        pensionAiScore: true,
        pensionAiVerdict: true,
        pensionAiReasoning: true,
        pensionAiReviewedAt: true,
        pensionAdminNotes: true,
        pensionAcceptedSizes: true,
        user: { select: { id: true, email: true, name: true, hostProfileJson: true } },
      },
    });

    const items = rows.map((r: any) => ({
      sitterProfileId: r.id,
      sitterId: r.sitterId,
      name: (r.displayName ?? r.user?.name ?? "").trim() || null,
      email: (r.user?.email ?? "").trim() || null,
      city: r.city ?? null,
      status: r.pensionVerifStatus ?? "not_submitted",
      photoCount: Array.isArray(r.pensionPhotoUrls) ? r.pensionPhotoUrls.length : 0,
      photoKeys: Array.isArray(r.pensionPhotoUrls) ? r.pensionPhotoUrls : [],
      submittedAt: r.pensionPhotoSubmittedAt instanceof Date ? r.pensionPhotoSubmittedAt.toISOString() : null,
      reviewedAt: r.pensionPhotoReviewedAt instanceof Date ? r.pensionPhotoReviewedAt.toISOString() : null,
      aiScore: typeof r.pensionAiScore === "number" ? r.pensionAiScore : null,
      aiVerdict: r.pensionAiVerdict ?? null,
      aiReasoning: r.pensionAiReasoning ?? null,
      aiReviewedAt: r.pensionAiReviewedAt instanceof Date ? r.pensionAiReviewedAt.toISOString() : null,
      adminNotes: r.pensionAdminNotes ?? null,
      pensionAcceptedSizes: Array.isArray(r.pensionAcceptedSizes) ? r.pensionAcceptedSizes : [],
      housingType: (() => {
        try {
          const hp = typeof r.user?.hostProfileJson === "string" ? JSON.parse(r.user.hostProfileJson) : r.user?.hostProfileJson;
          return hp?.boardingDetails?.housingType ?? null;
        } catch { return null; }
      })(),
      hasGarden: (() => {
        try {
          const hp = typeof r.user?.hostProfileJson === "string" ? JSON.parse(r.user.hostProfileJson) : r.user?.hostProfileJson;
          return typeof hp?.boardingDetails?.hasGarden === "boolean" ? hp.boardingDetails.hasGarden : null;
        } catch { return null; }
      })(),
    }));

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[api][admin][pension-verifications]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
