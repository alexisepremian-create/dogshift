import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const invite = req.cookies.get("dogsitter_invite")?.value;
    if (invite !== "ok") {
      return NextResponse.json({ ok: false, error: "INVITE_REQUIRED" }, { status: 403 });
    }

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

    const body = (await req.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    await (prisma as any).sitterApplication.create({
      data: {
        userId: ensured.id,
        data: body as any,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api][become-sitter][apply] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
