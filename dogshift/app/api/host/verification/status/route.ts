import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    void req;
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!email) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId: userId,
      email,
      name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
    });
    if (!ensured?.id) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

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
      where: { userId: ensured.id },
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
