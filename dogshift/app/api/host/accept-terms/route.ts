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
    if (!ensured) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const sitterProfile = await prisma.sitterProfile.findUnique({
      where: { userId: ensured.id },
      select: { id: true },
    });
    if (!sitterProfile) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const now = new Date();
    await prisma.sitterProfile.update({
      where: { userId: ensured.id },
      data: { termsAcceptedAt: now, termsVersion: CURRENT_TERMS_VERSION },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, termsVersion: CURRENT_TERMS_VERSION }, { status: 200 });
  } catch (err) {
    console.error("[api][host][accept-terms] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
