import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

function computeStatus(account: any) {
  const chargesEnabled = Boolean(account?.charges_enabled);
  const payoutsEnabled = Boolean(account?.payouts_enabled);
  const disabledReason = typeof account?.requirements?.disabled_reason === "string" ? account.requirements.disabled_reason : "";
  const currentlyDue = Array.isArray(account?.requirements?.currently_due) ? account.requirements.currently_due : [];

  if (chargesEnabled && payoutsEnabled) return "ENABLED" as const;
  if (disabledReason || currentlyDue.length > 0) return "RESTRICTED" as const;
  return "PENDING" as const;
}

export async function GET(req: NextRequest) {
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
      select: { id: true, stripeAccountId: true, stripeAccountStatus: true, stripeOnboardingCompletedAt: true },
    });
    if (!sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const accountId = typeof sitterProfile.stripeAccountId === "string" ? sitterProfile.stripeAccountId.trim() : "";
    if (!accountId) {
      return NextResponse.json({ ok: true, hasAccount: false, status: null }, { status: 200 });
    }

    const account = await stripe.accounts.retrieve(accountId);
    const status = computeStatus(account);

    const updateData: Record<string, unknown> = {
      stripeAccountStatus: status,
    };
    if (status === "ENABLED") {
      updateData.stripeOnboardingCompletedAt = new Date();
    }

    await db.sitterProfile.update({
      where: { id: sitterProfile.id },
      data: updateData,
      select: { id: true },
    });

    return NextResponse.json(
      {
        ok: true,
        hasAccount: true,
        stripeAccountId: accountId,
        status,
        charges_enabled: Boolean((account as any)?.charges_enabled),
        payouts_enabled: Boolean((account as any)?.payouts_enabled),
        details: {
          disabled_reason: (account as any)?.requirements?.disabled_reason ?? null,
          currently_due: Array.isArray((account as any)?.requirements?.currently_due) ? (account as any).requirements.currently_due : [],
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][host][stripe][connect][status] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
