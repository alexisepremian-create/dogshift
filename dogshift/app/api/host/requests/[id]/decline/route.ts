import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { stripe } from "@/lib/stripe";

type PrismaBookingDelegate = {
  findUnique: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
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
        stripePaymentIntentId: true,
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
    if (status !== "PENDING_ACCEPTANCE" && status !== "PAID") {
      return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 409 });
    }

    const paymentIntentId = typeof booking.stripePaymentIntentId === "string" ? booking.stripePaymentIntentId.trim() : "";
    const existingRefundId = typeof booking.stripeRefundId === "string" ? booking.stripeRefundId.trim() : "";
    const existingRefundedAt = booking.refundedAt ? new Date(String(booking.refundedAt)) : null;
    const alreadyRefunded = Boolean(existingRefundId || (existingRefundedAt && Number.isFinite(existingRefundedAt.getTime())));

    if (paymentIntentId && alreadyRefunded) {
      const updatedRaw = await prismaAny.booking.update({
        where: { id: bookingId },
        data: { status: "REFUNDED", canceledAt: new Date() },
        select: { id: true, status: true, canceledAt: true, stripeRefundId: true, refundedAt: true },
      });

      const updated = (updatedRaw as Record<string, unknown> | null) ?? null;

      return NextResponse.json(
        {
          ok: true,
          id: String(updated?.id ?? ""),
          status: String(updated?.status ?? ""),
          canceledAt:
            updated?.canceledAt instanceof Date
              ? updated.canceledAt.toISOString()
              : updated?.canceledAt
                ? String(updated.canceledAt)
                : null,
          stripeRefundId: typeof updated?.stripeRefundId === "string" ? updated.stripeRefundId : existingRefundId || null,
          refundedAt:
            updated?.refundedAt instanceof Date
              ? updated.refundedAt.toISOString()
              : updated?.refundedAt
                ? String(updated.refundedAt)
                : null,
        },
        { status: 200 }
      );
    }

    if (paymentIntentId) {
      try {
        const refund = await stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            reason: "requested_by_customer",
          },
          {
            idempotencyKey: `refund:${bookingId}:${paymentIntentId}`,
          }
        );

        const updatedRaw = await prismaAny.booking.update({
          where: { id: bookingId },
          data: {
            status: "REFUNDED",
            canceledAt: new Date(),
            stripeRefundId: refund.id,
            refundedAt: new Date(),
          },
          select: { id: true, status: true, canceledAt: true, stripeRefundId: true, refundedAt: true },
        });

        const updated = (updatedRaw as Record<string, unknown> | null) ?? null;

        return NextResponse.json(
          {
            ok: true,
            id: String(updated?.id ?? ""),
            status: String(updated?.status ?? ""),
            canceledAt:
              updated?.canceledAt instanceof Date
                ? updated.canceledAt.toISOString()
                : updated?.canceledAt
                  ? String(updated.canceledAt)
                  : null,
            stripeRefundId: typeof updated?.stripeRefundId === "string" ? updated.stripeRefundId : refund.id,
            refundedAt:
              updated?.refundedAt instanceof Date
                ? updated.refundedAt.toISOString()
                : updated?.refundedAt
                  ? String(updated.refundedAt)
                  : null,
          },
          { status: 200 }
        );
      } catch (err) {
        console.error("[api][host][requests][decline][POST] refund failed", { bookingId, paymentIntentId, err });
        try {
          await prismaAny.booking.update({
            where: { id: bookingId },
            data: { status: "REFUND_FAILED", canceledAt: new Date() },
            select: { id: true },
          });
        } catch {
          // ignore
        }
        return NextResponse.json(
          { ok: false, error: "REFUND_FAILED", message: "La réservation a été refusée, mais le remboursement a échoué. Contacte le support." },
          { status: 502 }
        );
      }
    }

    const updatedRaw = await prismaAny.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED", canceledAt: new Date() },
      select: { id: true, status: true, canceledAt: true },
    });

    const updated = (updatedRaw as Record<string, unknown> | null) ?? null;

    return NextResponse.json(
      {
        ok: true,
        id: String(updated?.id ?? ""),
        status: String(updated?.status ?? ""),
        canceledAt:
          updated?.canceledAt instanceof Date
            ? updated.canceledAt.toISOString()
            : updated?.canceledAt
              ? String(updated.canceledAt)
              : null,
      },
      { status: 200 }
    );
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Database schema missing. Run: prisma migrate dev" },
        { status: 500 }
      );
    }
    console.error("[api][host][requests][decline][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
