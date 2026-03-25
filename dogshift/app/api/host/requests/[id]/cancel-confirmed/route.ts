import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { executeHostInitiatedFullRefund } from "@/lib/bookings/hostInitiatedFullRefund";

type PrismaBookingDelegate = {
  findUnique: (args: unknown) => Promise<unknown>;
};

type PrismaClientLike = {
  booking: PrismaBookingDelegate;
};

const prismaAny = prisma as unknown as PrismaClientLike;

export const runtime = "nodejs";

async function resolveDbUserAndSitterId() {
  const { userId } = await auth();
  if (!userId) return { uid: null as string | null, sitterId: null as string | null };

  const clerkUser = await currentUser();
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!primaryEmail) return { uid: null as string | null, sitterId: null as string | null };

  const dbUser = await prisma.user.findUnique({ where: { email: primaryEmail }, select: { id: true, sitterId: true } });
  if (!dbUser) return { uid: null as string | null, sitterId: null as string | null };

  const sitterProfile = await prisma.sitterProfile.findUnique({
    where: { userId: dbUser.id },
    select: { sitterId: true, termsAcceptedAt: true, termsVersion: true },
  });
  const sitterId = typeof sitterProfile?.sitterId === "string" && sitterProfile.sitterId.trim() ? sitterProfile.sitterId.trim() : null;

  const termsOk = Boolean(sitterProfile?.termsAcceptedAt) && sitterProfile?.termsVersion === CURRENT_TERMS_VERSION;
  if (!termsOk) return { uid: dbUser.id, sitterId, termsBlocked: true as const };

  return { uid: dbUser.id, sitterId, termsBlocked: false as const };
}

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

function isServiceCompleted(endDate: unknown): boolean {
  if (!endDate) return false;
  const end = endDate instanceof Date ? endDate.getTime() : new Date(String(endDate)).getTime();
  if (!Number.isFinite(end)) return false;
  return Date.now() > end;
}

/**
 * Sitter cancels a CONFIRMED booking → full refund to the owner (same Stripe path as decline).
 * Scope: all CONFIRMED bookings that are not past endDate (service not completed).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = (await ctx.params) as { id?: string };
    const bookingId = typeof params?.id === "string" ? params.id : "";
    if (!bookingId) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

    const { uid, sitterId, termsBlocked } = await resolveDbUserAndSitterId();
    if (!uid) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    if (!sitterId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    if (termsBlocked) {
      return NextResponse.json({ ok: false, error: "TERMS_NOT_ACCEPTED", termsVersion: CURRENT_TERMS_VERSION }, { status: 403 });
    }

    const bookingRaw = await prismaAny.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        sitterId: true,
        status: true,
        archivedAt: true,
        endDate: true,
        stripePaymentIntentId: true,
        stripeChargeId: true,
        stripeTransferId: true,
        stripeRefundId: true,
        refundedAt: true,
      },
    });

    const booking = (bookingRaw as Record<string, unknown> | null) ?? null;

    if (!booking || String(booking.sitterId ?? "") !== sitterId) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.archivedAt) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const status = String(booking.status ?? "");
    if (status !== "CONFIRMED") {
      return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 409 });
    }

    if (isServiceCompleted(booking.endDate)) {
      return NextResponse.json({ ok: false, error: "ALREADY_COMPLETED" }, { status: 409 });
    }

    const paymentIntentId = typeof booking.stripePaymentIntentId === "string" ? booking.stripePaymentIntentId.trim() : "";
    const storedChargeId = typeof booking.stripeChargeId === "string" ? booking.stripeChargeId.trim() : "";
    const transferId = typeof booking.stripeTransferId === "string" ? booking.stripeTransferId.trim() : "";
    const existingRefundId = typeof booking.stripeRefundId === "string" ? booking.stripeRefundId.trim() : "";

    const refundOutcome = await executeHostInitiatedFullRefund({
      bookingId,
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: storedChargeId,
      stripeTransferId: transferId,
      stripeRefundId: existingRefundId,
      refundedAt: booking.refundedAt as Date | string | null | undefined,
      req,
    });

    if (refundOutcome.result === "MISSING_CHARGE") {
      return NextResponse.json({ ok: false, error: "MISSING_CHARGE" }, { status: 409 });
    }

    if (refundOutcome.result === "REFUND_FAILED") {
      return NextResponse.json(
        {
          ok: false,
          error: "REFUND_FAILED",
          message:
            refundOutcome.message ||
            "La réservation a été annulée, mais le remboursement a échoué. Contacte le support.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(refundOutcome.body, { status: 200 });
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Database schema missing. Run: prisma migrate dev" },
        { status: 500 }
      );
    }
    console.error("[api][host][requests][cancel-confirmed][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
