import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";
import { setBookingStatus } from "@/lib/bookings/setBookingStatus";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

type RoleJwt = { uid?: string; sub?: string };

function tokenUserId(token: RoleJwt | null) {
  const uid = typeof token?.uid === "string" ? token.uid : null;
  const sub = typeof token?.sub === "string" ? token.sub : null;
  return uid ?? sub;
}

function isCompleted(status: string, endDateIso: string | null) {
  if (status !== "PAID" && status !== "CONFIRMED") return false;
  if (!endDateIso) return false;
  const end = new Date(endDateIso).getTime();
  if (!Number.isFinite(end)) return false;
  return Date.now() > end;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as RoleJwt | null;
    const userId = tokenUserId(token);
    if (!userId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][cancel][PATCH] UNAUTHORIZED", { hasToken: Boolean(token) });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
    const bookingId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!bookingId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][cancel][PATCH] INVALID_ID", { bookingIdRaw: resolvedParams?.id });
      }
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        status: true,
        startDate: true,
        endDate: true,
        stripePaymentIntentId: true,
        stripeRefundId: true,
        refundedAt: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.userId !== userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const status = String(booking.status ?? "");

    if (status === "CONFIRMED") {
      return NextResponse.json({ ok: false, error: "CANNOT_CANCEL_CONFIRMED" }, { status: 409 });
    }

    if (status === "CANCELLED") {
      return NextResponse.json({ ok: false, error: "ALREADY_CANCELED" }, { status: 409 });
    }

    const endIso = booking.endDate instanceof Date ? booking.endDate.toISOString() : booking.endDate ? new Date(booking.endDate).toISOString() : null;
    if (isCompleted(status, endIso)) {
      return NextResponse.json({ ok: false, error: "ALREADY_COMPLETED" }, { status: 409 });
    }

    const startIso = booking.startDate instanceof Date ? booking.startDate.toISOString() : booking.startDate ? new Date(booking.startDate).toISOString() : null;
    if (startIso) {
      const startTs = new Date(startIso).getTime();
      if (Number.isFinite(startTs)) {
        const limit = startTs - 24 * 60 * 60 * 1000;
        if (Date.now() > limit) {
          return NextResponse.json({ ok: false, error: "TOO_LATE" }, { status: 409 });
        }
      }
    }

    const canceledAt = new Date();

    if (status === "DRAFT" || status === "PENDING_PAYMENT" || status === "PAYMENT_FAILED") {
      const updated = await (prisma as any).booking.update({
        where: { id: bookingId },
        data: {
          canceledAt,
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          updatedAt: true,
          canceledAt: true,
        },
      });

      const res = await setBookingStatus(bookingId, "CANCELLED" as any, { req });
      if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });

      return NextResponse.json({ ok: true, booking: { ...updated, status: "CANCELLED" } }, { status: 200 });
    }

    if (status === "PAID" || status === "PENDING_ACCEPTANCE") {
      const paymentIntentId =
        typeof booking.stripePaymentIntentId === "string" && booking.stripePaymentIntentId.trim()
          ? booking.stripePaymentIntentId.trim()
          : "";

      if (!paymentIntentId) {
        return NextResponse.json({ ok: false, error: "MISSING_PAYMENT_INTENT" }, { status: 409 });
      }

      try {
        const refund = await stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            reason: "requested_by_customer",
          },
          {
            idempotencyKey: `refund:owner_cancel:${bookingId}:${paymentIntentId}`,
          }
        );

        const updated = await (prisma as any).booking.update({
          where: { id: bookingId },
          data: {
            canceledAt,
            stripeRefundId: refund.id,
            refundedAt: new Date(),
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            updatedAt: true,
            canceledAt: true,
            stripeRefundId: true,
            refundedAt: true,
          },
        });

        const res = await setBookingStatus(bookingId, "REFUNDED" as any, { req });
        if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });

        return NextResponse.json({ ok: true, booking: { ...updated, status: "REFUNDED" } }, { status: 200 });
      } catch (err) {
        console.error("[api][account][bookings][id][cancel][PATCH] refund failed", { bookingId, err });

        const updated = await (prisma as any).booking.update({
          where: { id: bookingId },
          data: {
            canceledAt,
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            updatedAt: true,
            canceledAt: true,
          },
        });

        const res = await setBookingStatus(bookingId, "REFUND_FAILED" as any, { req });
        if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });

        return NextResponse.json(
          { ok: false, error: "REFUND_FAILED", booking: { ...updated, status: "REFUND_FAILED" } },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 409 });
  } catch (err) {
    console.error("[api][account][bookings][id][cancel][PATCH] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
