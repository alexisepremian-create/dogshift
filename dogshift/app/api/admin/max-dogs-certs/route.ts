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
        maxDogsCertVerifStatus: { in: ["pending", "approved", "rejected"] },
      },
      orderBy: { maxDogsCertSubmittedAt: "desc" },
      select: {
        id: true,
        sitterId: true,
        displayName: true,
        city: true,
        maxDogsCertVerifStatus: true,
        maxDogsCertPhotoKey: true,
        maxDogsCertSubmittedAt: true,
        maxDogsCertReviewedAt: true,
        maxDogsCertAdminNotes: true,
        acceptanceCriteria: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    const items = rows.map((r: any) => ({
      sitterProfileId: r.id,
      sitterId: r.sitterId,
      name: (r.displayName ?? r.user?.name ?? "").trim() || null,
      email: (r.user?.email ?? "").trim() || null,
      city: r.city ?? null,
      status: r.maxDogsCertVerifStatus ?? "not_submitted",
      photoKey: r.maxDogsCertPhotoKey ?? null,
      maxDogs: (() => {
        try {
          const ac = r.acceptanceCriteria;
          if (ac && typeof ac === "object") return (ac as Record<string, unknown>).maxDogs ?? null;
          return null;
        } catch { return null; }
      })(),
      submittedAt: r.maxDogsCertSubmittedAt instanceof Date ? r.maxDogsCertSubmittedAt.toISOString() : null,
      reviewedAt: r.maxDogsCertReviewedAt instanceof Date ? r.maxDogsCertReviewedAt.toISOString() : null,
      adminNotes: r.maxDogsCertAdminNotes ?? null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[api][admin][max-dogs-certs]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
