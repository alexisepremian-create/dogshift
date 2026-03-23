import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { prisma } from "@/lib/prisma";
import { hashActivationCode, normalizeSitterLifecycleStatus } from "@/lib/sitterContract";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!email) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId: userId,
      email,
      name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
    });
    if (!ensured?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { code?: string } | null;
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!code) {
      return NextResponse.json({ ok: false, error: "CODE_REQUIRED" }, { status: 400 });
    }

    const sitterProfile = await (prisma as any).sitterProfile.findUnique({
      where: { userId: ensured.id },
      select: {
        id: true,
        published: true,
        lifecycleStatus: true,
        activationCodeHash: true,
        activationCodeIssuedAt: true,
      },
    });

    if (!sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const lifecycleStatus = normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, Boolean(sitterProfile.published));
    if (lifecycleStatus !== "contract_signed") {
      return NextResponse.json({ ok: false, error: "ACCOUNT_NOT_READY_FOR_ACTIVATION" }, { status: 409 });
    }

    if (typeof sitterProfile.activationCodeHash !== "string" || !sitterProfile.activationCodeHash.trim()) {
      return NextResponse.json({ ok: false, error: "ACTIVATION_CODE_NOT_ISSUED" }, { status: 409 });
    }

    const candidateHash = hashActivationCode(code);
    if (candidateHash !== sitterProfile.activationCodeHash) {
      return NextResponse.json({ ok: false, error: "INVALID_ACTIVATION_CODE" }, { status: 403 });
    }

    const now = new Date();
    await (prisma as any).sitterProfile.update({
      where: { id: sitterProfile.id },
      data: {
        lifecycleStatus: "activated",
        activatedAt: now,
        activationCodeUsedAt: now,
      },
      select: { id: true },
    });

    return NextResponse.json(
      {
        ok: true,
        lifecycleStatus: "activated",
        activatedAt: now.toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][host][activation-code][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
