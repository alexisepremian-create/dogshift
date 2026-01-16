import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const existingUser = await (prisma as any).user.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
    const dbUserId = typeof existingUser?.id === "string" ? existingUser.id : "";

    let ensuredId = dbUserId;
    if (!ensuredId) {
      const clerkUser = await currentUser();
      const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
      if (!primaryEmail) {
        return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }

      const ensured = await ensureDbUserByClerkUserId({
        clerkUserId: userId,
        email: primaryEmail,
        name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
      });
      if (!ensured?.id) {
        return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
      }
      ensuredId = ensured.id;
    }

    const sitterProfile = await prisma.sitterProfile.findUnique({
      where: { userId: ensuredId },
      select: { id: true },
    });
    if (!sitterProfile) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const now = new Date();
    console.info("[api][host][accept-terms] before", { clerkUserId: userId, dbUserId: ensuredId, now: now.toISOString() });
    await prisma.sitterProfile.update({
      where: { userId: ensuredId },
      data: { termsAcceptedAt: now, termsVersion: CURRENT_TERMS_VERSION },
      select: { id: true },
    });

    console.info("[api][host][accept-terms] after", {
      clerkUserId: userId,
      dbUserId: ensuredId,
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: now.toISOString(),
    });

    return NextResponse.json({ ok: true, termsVersion: CURRENT_TERMS_VERSION }, { status: 200 });
  } catch (err) {
    console.error("[api][host][accept-terms] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
