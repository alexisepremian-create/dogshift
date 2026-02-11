import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { deleteObject } from "@/lib/r2";

export const runtime = "nodejs";

async function safeDelete(key: string) {
  try {
    await deleteObject({ key });
  } catch {
    // ignore
  }
}

export async function POST(req: NextRequest) {
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
        findUnique: (args: unknown) => Promise<{ id: string; idDocumentUrl?: string | null; selfieUrl?: string | null } | null>;
        update: (args: unknown) => Promise<unknown>;
      };
    };

    const sitterProfile = await db.sitterProfile.findUnique({
      where: { userId: ensured.id },
      select: { id: true, idDocumentUrl: true, selfieUrl: true },
    });

    if (!sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (typeof sitterProfile.idDocumentUrl === "string" && sitterProfile.idDocumentUrl.trim()) {
      await safeDelete(sitterProfile.idDocumentUrl.trim());
    }
    if (typeof sitterProfile.selfieUrl === "string" && sitterProfile.selfieUrl.trim()) {
      await safeDelete(sitterProfile.selfieUrl.trim());
    }

    await db.sitterProfile.update({
      where: { id: sitterProfile.id },
      data: {
        verificationStatus: "not_verified",
        idDocumentUrl: null,
        selfieUrl: null,
        verificationSubmittedAt: null,
        verificationReviewedAt: null,
        verificationNotes: null,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api][host][verification][delete] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
