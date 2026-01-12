import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/inApp";
import { resolveBookingParticipants, sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";

export const runtime = "nodejs";

async function notifyPendingAcceptance(req: NextRequest, bookingId: string) {
  try {
    const participants = await resolveBookingParticipants(bookingId);
    if (!participants) return;

    if (participants.sitter?.id) {
      try {
        await createNotification({
          userId: participants.sitter.id,
          type: "newBookingRequest",
          title: "Nouvelle demande de réservation",
          body: null,
          entityId: bookingId,
          url: "/host/requests",
          idempotencyKey: `newBookingRequest:${bookingId}:pending_acceptance`,
          metadata: { bookingId },
        });
      } catch (err) {
        console.error("[api][stripe][webhook] in-app notification failed (newBookingRequest)", err);
      }

      await sendNotificationEmail({
        req,
        recipientUserId: participants.sitter.id,
        key: "newBookingRequest",
        entityId: `${bookingId}:pending_acceptance`,
        payload: { kind: "bookingRequest", bookingId },
      });
    }

    if (participants.owner?.id) {
      try {
        await createNotification({
          userId: participants.owner.id,
          type: "paymentReceived",
          title: "Paiement reçu",
          body: null,
          entityId: bookingId,
          url: `/account/bookings?id=${encodeURIComponent(bookingId)}`,
          idempotencyKey: `paymentReceived:${bookingId}:payment_received`,
          metadata: { bookingId },
        });
      } catch (err) {
        console.error("[api][stripe][webhook] in-app notification failed (paymentReceived owner)", err);
      }

      await sendNotificationEmail({
        req,
        recipientUserId: participants.owner.id,
        key: "paymentReceived",
        entityId: `${bookingId}:payment_received`,
        payload: { kind: "paymentReceived", bookingId },
      });
    }

    if (participants.sitter?.id) {
      try {
        await createNotification({
          userId: participants.sitter.id,
          type: "paymentReceived",
          title: "Paiement reçu",
          body: null,
          entityId: bookingId,
          url: "/host/requests",
          idempotencyKey: `paymentReceived:${bookingId}:payment_received`,
          metadata: { bookingId },
        });
      } catch (err) {
        console.error("[api][stripe][webhook] in-app notification failed (paymentReceived sitter)", err);
      }

      await sendNotificationEmail({
        req,
        recipientUserId: participants.sitter.id,
        key: "paymentReceived",
        entityId: `${bookingId}:payment_received`,
        payload: { kind: "paymentReceived", bookingId },
      });
    }
  } catch (err) {
    console.error("[api][stripe][webhook] notifyPendingAcceptance failed", { bookingId, err });
  }
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "MISSING_WEBHOOK_SECRET" }, { status: 500 });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ ok: false, error: "MISSING_SIGNATURE" }, { status: 400 });
    }

    const body = await req.text();

    console.log(`[webhook][stripe] received signature=${signature.slice(0, 16)}... bytes=${body.length}`);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
    } catch (err) {
      console.error("[api][stripe][webhook] signature verification failed", err);
      return NextResponse.json({ ok: false, error: "INVALID_SIGNATURE" }, { status: 400 });
    }

    console.log(`[webhook][stripe] event type=${event.type} id=${event.id} livemode=${event.livemode}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = typeof session.metadata?.bookingId === "string" ? session.metadata.bookingId : "";
      const sessionId = typeof session.id === "string" ? session.id : "";
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : "";

      if (!bookingId && !sessionId) {
        console.warn(`[webhook][stripe] event=checkout.session.completed missing bookingId+sessionId`);
        return NextResponse.json({ received: true, ignored: true, reason: "MISSING_BOOKING_ID" }, { status: 200 });
      }

      console.log(
        `[webhook][stripe] event=checkout.session.completed bookingId=${bookingId || "?"} session=${sessionId || "?"} -> PENDING_ACCEPTANCE`
      );

      const res = await (prisma as any).booking.updateMany({
        where: {
          ...(bookingId ? { id: bookingId } : {}),
          ...(sessionId ? { stripeSessionId: sessionId } : {}),
          status: { notIn: ["CONFIRMED", "CANCELLED"] },
        },
        data: {
          status: "PENDING_ACCEPTANCE",
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
          ...(sessionId ? { stripeSessionId: sessionId } : {}),
        },
      });

      console.log(`[webhook][stripe] booking.updateMany count=${res?.count ?? "?"}`);

      if (bookingId && Number(res?.count ?? 0) > 0) {
        await notifyPendingAcceptance(req, bookingId);
      }

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const bookingId = typeof intent.metadata?.bookingId === "string" ? intent.metadata.bookingId : "";

      if (!bookingId) {
        console.warn(`[webhook][stripe] event=payment_intent.succeeded bookingId=missing intent=${intent.id}`);
        return NextResponse.json({ received: true, ignored: true, reason: "MISSING_BOOKING_ID" }, { status: 200 });
      }

      console.log(`[webhook][stripe] event=payment_intent.succeeded bookingId=${bookingId} -> PENDING_ACCEPTANCE`);

      const res = await (prisma as any).booking.updateMany({
        where: {
          id: bookingId,
          status: { notIn: ["CONFIRMED", "CANCELLED"] },
        },
        data: {
          status: "PENDING_ACCEPTANCE",
          stripePaymentIntentId: intent.id,
        },
      });

      console.log(`[webhook][stripe] booking.updateMany count=${res?.count ?? "?"}`);

      if (Number(res?.count ?? 0) > 0) {
        await notifyPendingAcceptance(req, bookingId);
      }

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const bookingId = typeof intent.metadata?.bookingId === "string" ? intent.metadata.bookingId : "";

      if (!bookingId) {
        console.warn(`[webhook][stripe] event=payment_intent.payment_failed bookingId=missing intent=${intent.id}`);
        return NextResponse.json({ received: true, ignored: true, reason: "MISSING_BOOKING_ID" }, { status: 200 });
      }

      console.log(`[webhook][stripe] event=payment_intent.payment_failed bookingId=${bookingId} -> PAYMENT_FAILED`);

      const res = await (prisma as any).booking.updateMany({
        where: {
          id: bookingId,
          status: { notIn: ["CONFIRMED", "CANCELLED"] },
        },
        data: {
          status: "PAYMENT_FAILED",
          stripePaymentIntentId: intent.id,
        },
      });

      console.log(`[webhook][stripe] booking.updateMany count=${res?.count ?? "?"}`);

      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.log(`[webhook][stripe] ignored event type=${event.type}`);
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  } catch (err) {
    console.error("[api][stripe][webhook] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
