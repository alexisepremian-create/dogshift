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

    let onboardingCompletedAt: Date | null = sitterProfile.stripeOnboardingCompletedAt ? new Date(sitterProfile.stripeOnboardingCompletedAt) : null;
    if (status === "ENABLED" && !onboardingCompletedAt) {
      onboardingCompletedAt = new Date();
    }

    const updateData: Record<string, unknown> = {
      stripeAccountStatus: status,
    };
    if (status === "ENABLED") {
      updateData.stripeOnboardingCompletedAt = onboardingCompletedAt;
    }

    await db.sitterProfile.update({
      where: { id: sitterProfile.id },
      data: updateData,
      select: { id: true },
    });

    let balance: { availableCents: number; pendingCents: number } | null = null;
    let nextPayoutArrivalDate: string | null = null;
    if (status === "ENABLED") {
      try {
        const b = (await stripe.balance.retrieve({ stripeAccount: accountId })) as any;
        const available = Array.isArray(b?.available) ? b.available : [];
        const pending = Array.isArray(b?.pending) ? b.pending : [];
        const sum = (items: any[]) =>
          items
            .filter((it) => String(it?.currency ?? "").toLowerCase() === "chf")
            .reduce((acc, it) => acc + (typeof it?.amount === "number" ? it.amount : 0), 0);
        balance = { availableCents: sum(available), pendingCents: sum(pending) };
      } catch (err) {
        console.error("[api][host][stripe][connect][status] balance retrieve failed", err);
      }

      try {
        const candidateArrivalDates: number[] = [];

        const pendingPayouts = await stripe.payouts.list({ limit: 10, status: "pending" }, { stripeAccount: accountId });
        for (const p of pendingPayouts.data ?? []) {
          if (typeof (p as any)?.arrival_date === "number") {
            candidateArrivalDates.push((p as any).arrival_date);
          }
        }

        const inTransitPayouts = await stripe.payouts.list({ limit: 10, status: "in_transit" }, { stripeAccount: accountId });
        for (const p of inTransitPayouts.data ?? []) {
          if (typeof (p as any)?.arrival_date === "number") {
            candidateArrivalDates.push((p as any).arrival_date);
          }
        }

        if (candidateArrivalDates.length > 0) {
          const next = Math.min(...candidateArrivalDates);
          nextPayoutArrivalDate = new Date(next * 1000).toISOString();
        }
      } catch (err) {
        console.error("[api][host][stripe][connect][status] payouts list failed", err);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        hasAccount: true,
        stripeAccountId: accountId,
        status,
        stripeOnboardingCompletedAt: onboardingCompletedAt ? onboardingCompletedAt.toISOString() : null,
        balance,
        nextPayoutArrivalDate,
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
