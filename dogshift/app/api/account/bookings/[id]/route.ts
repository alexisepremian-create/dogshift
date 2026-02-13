import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { stripe } from "@/lib/stripe";
import { setBookingStatus } from "@/lib/bookings/setBookingStatus";

export const runtime = "nodejs";

function isPrismaInconsistentResultError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes("inconsistent query result") || msg.includes("P2025");
}

type BookingDetailResponse = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sitterId: string;
  service: string | null;
  startDate: string | null;
  endDate: string | null;
  message: string | null;
  status: string;
  canceledAt: string | null;
  amount: number;
  currency: string;
  platformFeeAmount: number;
  stripePaymentIntentId: string | null;
  sitter: {
    sitterId: string;
    name: string;
    avatarUrl: string | null;
  };
};

async function reconcileBookingPaymentIfNeeded(
  booking: { id: string; status: string; stripePaymentIntentId: string | null },
  req: NextRequest
) {
  const status = String(booking.status ?? "");
  const paymentIntentId = typeof booking.stripePaymentIntentId === "string" ? booking.stripePaymentIntentId : "";

  if (status !== "PENDING_PAYMENT" || !paymentIntentId) return null;

  console.log("[api][account][bookings][id][GET] reconcile start", {
    bookingId: booking.id,
    paymentIntentId,
  });

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const intentStatus = typeof intent.status === "string" ? intent.status : "";

    if (intentStatus !== "succeeded") {
      console.log("[api][account][bookings][id][GET] reconcile skip", {
        bookingId: booking.id,
        paymentIntentId,
        intentStatus: intentStatus || null,
      });
      return null;
    }

    await (prisma as any).booking.update({
      where: { id: booking.id },
      data: {
        stripePaymentIntentId: paymentIntentId,
      },
      select: { id: true },
    });

    const res = await setBookingStatus(booking.id, "PAID" as any, { req });

    console.log("[api][account][bookings][id][GET] reconcile updated", {
      bookingId: booking.id,
      paymentIntentId,
      changed: res.ok ? res.changed : null,
    });

    if (res.ok && res.changed) {
      return "PAID";
    }
  } catch (err) {
    console.error("[api][account][bookings][id][GET] reconcile error", {
      bookingId: booking.id,
      paymentIntentId,
      err,
    });
  }

  return null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][GET] UNAUTHORIZED");
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
    const bookingId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!bookingId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][GET] INVALID_ID", { bookingIdRaw: resolvedParams?.id });
      }
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        sitterId: true,
        service: true,
        startDate: true,
        endDate: true,
        message: true,
        status: true,
        canceledAt: true,
        amount: true,
        currency: true,
        platformFeeAmount: true,
        stripePaymentIntentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.userId !== userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const reconciledStatus = await reconcileBookingPaymentIfNeeded(
      {
        id: String(booking.id),
        status: String(booking.status ?? ""),
        stripePaymentIntentId: typeof booking.stripePaymentIntentId === "string" ? booking.stripePaymentIntentId : null,
      },
      req
    );

    const sitterKey = typeof booking?.sitterId === "string" ? booking.sitterId.trim() : "";
    const sitterUser = await (prisma as any).user.findFirst({
      where: {
        OR: [{ sitterId: sitterKey }, { id: sitterKey }],
      },
      select: {
        id: true,
        sitterId: true,
        name: true,
        image: true,
        sitterProfile: { select: { displayName: true, avatarUrl: true } },
      },
    });

    const displayName =
      (typeof sitterUser?.sitterProfile?.displayName === "string" && sitterUser.sitterProfile.displayName.trim()
        ? sitterUser.sitterProfile.displayName.trim()
        : null) ??
      (typeof sitterUser?.name === "string" && sitterUser.name.trim() ? sitterUser.name.trim() : "Dogsitter");

    const avatarUrlRaw =
      (typeof sitterUser?.sitterProfile?.avatarUrl === "string" && sitterUser.sitterProfile.avatarUrl.trim()
        ? sitterUser.sitterProfile.avatarUrl.trim()
        : null) ??
      (typeof sitterUser?.image === "string" && sitterUser.image.trim() ? sitterUser.image.trim() : null);

    const payload: BookingDetailResponse = {
      id: String(booking.id),
      createdAt: booking.createdAt instanceof Date ? booking.createdAt.toISOString() : new Date(booking.createdAt).toISOString(),
      updatedAt: booking.updatedAt instanceof Date ? booking.updatedAt.toISOString() : new Date(booking.updatedAt).toISOString(),
      sitterId: String(booking.sitterId),
      service: typeof booking.service === "string" ? booking.service : null,
      startDate: booking.startDate instanceof Date ? booking.startDate.toISOString() : booking.startDate ? new Date(booking.startDate).toISOString() : null,
      endDate: booking.endDate instanceof Date ? booking.endDate.toISOString() : booking.endDate ? new Date(booking.endDate).toISOString() : null,
      message: typeof booking.message === "string" ? booking.message : null,
      status: reconciledStatus ?? String(booking.status ?? "PENDING_PAYMENT"),
      canceledAt: booking.canceledAt instanceof Date ? booking.canceledAt.toISOString() : booking.canceledAt ? new Date(booking.canceledAt).toISOString() : null,
      amount: typeof booking.amount === "number" ? booking.amount : 0,
      currency: typeof booking.currency === "string" ? booking.currency : "chf",
      platformFeeAmount: typeof booking.platformFeeAmount === "number" ? booking.platformFeeAmount : 0,
      stripePaymentIntentId: typeof booking.stripePaymentIntentId === "string" ? booking.stripePaymentIntentId : null,
      sitter: {
        sitterId: String((typeof sitterUser?.sitterId === "string" && sitterUser.sitterId) || booking.sitterId || ""),
        name: displayName,
        avatarUrl: avatarUrlRaw,
      },
    };

    return NextResponse.json({ ok: true, booking: payload }, { status: 200 });
  } catch (err) {
    if (isPrismaInconsistentResultError(err)) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][GET] INCONSISTENT_RESULT", { err });
      }
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][bookings][id][GET] error", { err });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
