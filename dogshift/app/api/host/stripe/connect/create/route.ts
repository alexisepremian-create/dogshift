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

    const db = prisma as any;

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

    const sitterProfile = await db.sitterProfile.findUnique({
      where: { userId: ensured.id },
      select: { id: true, userId: true, stripeAccountId: true, stripeAccountStatus: true },
    });
    if (!sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const existing = typeof sitterProfile.stripeAccountId === "string" ? sitterProfile.stripeAccountId.trim() : "";
    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          stripeAccountId: existing,
          stripeAccountStatus: sitterProfile.stripeAccountStatus ?? "PENDING",
          reused: true,
        },
        { status: 200 }
      );
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "CH",
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    await db.sitterProfile.update({
      where: { id: sitterProfile.id },
      data: {
        stripeAccountId: account.id,
        stripeAccountStatus: "PENDING",
        stripeOnboardingCompletedAt: null,
      },
      select: { id: true },
    });

    return NextResponse.json(
      {
        ok: true,
        stripeAccountId: account.id,
        stripeAccountStatus: "PENDING",
        reused: false,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][host][stripe][connect][create] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
