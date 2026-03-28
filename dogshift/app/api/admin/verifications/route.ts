import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const db = prisma as unknown as {
      sitterProfile: {
        findMany: (args: unknown) => Promise<
          Array<{
            id: string;
            sitterId: string;
            displayName?: string | null;
            city?: string | null;
            postalCode?: string | null;
            verificationStatus?: string | null;
            verificationSubmittedAt?: Date | null;
            verificationReviewedAt?: Date | null;
            verificationNotes?: string | null;
            idDocumentUrl?: string | null;
            selfieUrl?: string | null;
            user?: { id: string; email?: string | null; name?: string | null } | null;
          }>
        >;
      };
    };

    const rows = await db.sitterProfile.findMany({
      where: {
        verificationStatus: { in: ["pending", "approved", "rejected"] },
      },
      orderBy: { verificationSubmittedAt: "desc" },
      select: {
        id: true,
        sitterId: true,
        displayName: true,
        city: true,
        postalCode: true,
        verificationStatus: true,
        verificationSubmittedAt: true,
        verificationReviewedAt: true,
        verificationNotes: true,
        idDocumentUrl: true,
        selfieUrl: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    const items = rows.map((r) => ({
      sitterProfileId: r.id,
      userId: r.user?.id ?? null,
      sitterId: r.sitterId,
      name: (r.displayName ?? r.user?.name ?? "").trim() || null,
      email: (r.user?.email ?? "").trim() || null,
      city: r.city ?? null,
      postalCode: r.postalCode ?? null,
      status: (r.verificationStatus ?? "not_verified") as string,
      submittedAt: r.verificationSubmittedAt instanceof Date ? r.verificationSubmittedAt.toISOString() : null,
      reviewedAt: r.verificationReviewedAt instanceof Date ? r.verificationReviewedAt.toISOString() : null,
      notes: typeof r.verificationNotes === "string" ? r.verificationNotes : null,
      idDocumentKey: typeof r.idDocumentUrl === "string" ? r.idDocumentUrl : null,
      selfieKey: typeof r.selfieUrl === "string" ? r.selfieUrl : null,
    }));

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err) {
    console.error("[api][admin][verifications] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
