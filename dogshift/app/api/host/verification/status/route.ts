import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    void req;
    const __authed = await getAuthedDbUser();
    const userId = __authed?.id ?? null;
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    // currentUser() removed — use __authed.email / __authed.name
    const email = __authed?.email ?? "";
    if (!email) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    if (!__authed?.id) return new Response("Unauthorized", { status: 401 });

    const db = prisma as unknown as {
      sitterProfile: {
        findUnique: (args: unknown) => Promise<
          | {
              sitterId: string;
              verificationStatus?: string | null;
              idDocumentUrl?: string | null;
              selfieUrl?: string | null;
              verificationSubmittedAt?: Date | null;
              verificationReviewedAt?: Date | null;
              verificationNotes?: string | null;
            }
          | null
        >;
      };
    };

    const sitterProfile = await db.sitterProfile.findUnique({
      where: { userId: __authed.id },
      select: {
        sitterId: true,
        verificationStatus: true,
        idDocumentUrl: true,
        selfieUrl: true,
        verificationSubmittedAt: true,
        verificationReviewedAt: true,
        verificationNotes: true,
      },
    });

    if (!sitterProfile?.sitterId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const status = typeof sitterProfile.verificationStatus === "string" ? sitterProfile.verificationStatus : "not_verified";

    return NextResponse.json(
      {
        ok: true,
        sitterId: sitterProfile.sitterId,
        verification: {
          status,
          idDocumentKey: typeof sitterProfile.idDocumentUrl === "string" ? sitterProfile.idDocumentUrl : null,
          selfieKey: typeof sitterProfile.selfieUrl === "string" ? sitterProfile.selfieUrl : null,
          submittedAt: sitterProfile.verificationSubmittedAt instanceof Date ? sitterProfile.verificationSubmittedAt.toISOString() : null,
          reviewedAt: sitterProfile.verificationReviewedAt instanceof Date ? sitterProfile.verificationReviewedAt.toISOString() : null,
          notes: typeof sitterProfile.verificationNotes === "string" ? sitterProfile.verificationNotes : null,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][host][verification][status] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
