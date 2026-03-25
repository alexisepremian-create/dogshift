import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { setBookingStatus } from "@/lib/bookings/setBookingStatus";
import { stripe } from "@/lib/stripe";

type PrismaBookingDelegate = {
  findUnique: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

type PrismaClientLike = {
  booking: PrismaBookingDelegate;
};

const prismaAny = prisma as unknown as PrismaClientLike;

export type HostInitiatedRefundOkBody = {
  ok: true;
  id: string;
  status: "REFUNDED" | "CANCELLED";
  canceledAt: string | null;
  stripeRefundId: string | null;
  refundedAt: string | null;
};

/**
 * Host/sitter-initiated cancel with full Stripe refund when a PaymentIntent exists.
 * Same Stripe semantics as decline: reverse_transfer + refund_application_fee when transferId is set;
 * idempotent refund per booking + payment intent.
 */
export async function executeHostInitiatedFullRefund(params: {
  bookingId: string;
  stripePaymentIntentId: string;
  stripeChargeId: string;
  stripeTransferId: string;
  stripeRefundId: string;
  refundedAt: Date | string | null | undefined;
  req: NextRequest;
}): Promise<
  | { result: "REFUNDED"; body: HostInitiatedRefundOkBody }
  | { result: "CANCELLED"; body: HostInitiatedRefundOkBody }
  | { result: "MISSING_CHARGE" }
  | { result: "REFUND_FAILED"; message: string }
> {
  const bookingId = params.bookingId;
  const paymentIntentId = params.stripePaymentIntentId.trim();
  const storedChargeId = params.stripeChargeId.trim();
  const transferId = params.stripeTransferId.trim();
  const existingRefundId = params.stripeRefundId.trim();
  const existingRefundedAt = params.refundedAt ? new Date(String(params.refundedAt)) : null;
  const alreadyRefunded = Boolean(existingRefundId || (existingRefundedAt && Number.isFinite(existingRefundedAt.getTime())));

  if (paymentIntentId && alreadyRefunded) {
    const updatedRaw = await prismaAny.booking.update({
      where: { id: bookingId },
      data: { canceledAt: new Date() },
      select: { id: true, stripeRefundId: true, refundedAt: true, canceledAt: true },
    });

    const updated = (updatedRaw as Record<string, unknown> | null) ?? null;

    await setBookingStatus(bookingId, "REFUNDED" as any, { req: params.req });

    const body: HostInitiatedRefundOkBody = {
      ok: true,
      id: String(updated?.id ?? ""),
      status: "REFUNDED",
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
    };
    return { result: "REFUNDED", body };
  }

  if (paymentIntentId) {
    try {
      const intent = (await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] })) as any;
      const expandedLatestChargeId = typeof intent?.latest_charge?.id === "string" ? String(intent.latest_charge.id) : "";
      const latestChargeId = typeof intent?.latest_charge === "string" ? intent.latest_charge : "";
      const chargeId = storedChargeId || expandedLatestChargeId || latestChargeId;
      let resolvedChargeId = chargeId;
      if (!resolvedChargeId) {
        const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });
        resolvedChargeId = typeof charges?.data?.[0]?.id === "string" ? charges.data[0].id : "";
      }
      if (!resolvedChargeId) {
        return { result: "MISSING_CHARGE" };
      }

      const refund = await stripe.refunds.create(
        {
          charge: resolvedChargeId,
          reason: "requested_by_customer",
          ...(transferId ? { reverse_transfer: true, refund_application_fee: true } : null),
        } as any,
        {
          idempotencyKey: `refund:${bookingId}:${paymentIntentId}`,
        }
      );

      const updatedRaw = await prismaAny.booking.update({
        where: { id: bookingId },
        data: {
          canceledAt: new Date(),
          stripeRefundId: refund.id,
          refundedAt: new Date(),
        },
        select: { id: true, canceledAt: true, stripeRefundId: true, refundedAt: true },
      });

      const updated = (updatedRaw as Record<string, unknown> | null) ?? null;

      await setBookingStatus(bookingId, "REFUNDED" as any, { req: params.req });

      const body: HostInitiatedRefundOkBody = {
        ok: true,
        id: String(updated?.id ?? ""),
        status: "REFUNDED",
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
      };
      return { result: "REFUNDED", body };
    } catch (err) {
      console.error("[bookings][hostInitiatedFullRefund] refund failed", { bookingId, paymentIntentId, err });
      try {
        await prismaAny.booking.update({
          where: { id: bookingId },
          data: { canceledAt: new Date() },
          select: { id: true },
        });
      } catch {
        // ignore
      }

      await setBookingStatus(bookingId, "REFUND_FAILED" as any, { req: params.req });
      return {
        result: "REFUND_FAILED",
        message: "La réservation a été annulée côté sitter, mais le remboursement a échoué. Contacte le support.",
      };
    }
  }

  const updatedRaw = await prismaAny.booking.update({
    where: { id: bookingId },
    data: { canceledAt: new Date() },
    select: { id: true, canceledAt: true },
  });

  const updated = (updatedRaw as Record<string, unknown> | null) ?? null;

  await setBookingStatus(bookingId, "CANCELLED" as any, { req: params.req });

  const body: HostInitiatedRefundOkBody = {
    ok: true,
    id: String(updated?.id ?? ""),
    status: "CANCELLED",
    canceledAt:
      updated?.canceledAt instanceof Date
        ? updated.canceledAt.toISOString()
        : updated?.canceledAt
          ? String(updated.canceledAt)
          : null,
    stripeRefundId: null,
    refundedAt: null,
  };
  return { result: "CANCELLED", body };
}
