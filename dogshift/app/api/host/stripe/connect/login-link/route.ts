import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    void req;

    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const clerk = await currentUser();
    const email = clerk?.primaryEmailAddress?.emailAddress ?? "";
    if (!email) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId,
      email,
      name: typeof clerk?.fullName === "string" ? clerk.fullName : null,
    });
    if (!ensured?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const db = prisma as any;
    const sitterProfile = await db.sitterProfile.findUnique({
      where: { userId: ensured.id },
      select: { id: true, stripeAccountId: true },
    });
    if (!sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const account = typeof sitterProfile.stripeAccountId === "string" ? sitterProfile.stripeAccountId.trim() : "";
    if (!account) {
      return NextResponse.json({ ok: false, error: "MISSING_STRIPE_ACCOUNT" }, { status: 409 });
    }

    const link = await stripe.accounts.createLoginLink(account);
    return NextResponse.json({ ok: true, url: link.url }, { status: 200 });
  } catch (err) {
    console.error("[api][host][stripe][connect][login-link] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
