import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/inApp";
import { resolveBookingParticipants, sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";

export const runtime = "nodejs";

function getStripeAccountHeader(req: NextRequest) {
  return req.headers.get("stripe-account") || req.headers.get("Stripe-Account") || "";
}

function safeObjectKeys(obj: unknown) {
  try {
    if (!obj || typeof obj !== "object") return [] as string[];
    return Object.keys(obj as Record<string, unknown>);
  } catch {
    return [] as string[];
  }
}

async function markBookingPaid({
  req,
  bookingId,
  paymentIntentId,
  sessionId,
  transferId,
  chargeId,
  eventId,
  eventType,
  livemode,
}: {
  req: NextRequest;
  bookingId: string;
  paymentIntentId?: string;
  sessionId?: string;
  transferId?: string;
  chargeId?: string;
  eventId: string;
  eventType: string;
  livemode: boolean;
}) {
  const stripeAccount = getStripeAccountHeader(req);

  console.log("[webhook][stripe] reconcile:markPaid", {
    eventId,
    eventType,
    livemode,
    stripeAccount: stripeAccount || null,
    bookingId,
    paymentIntentId: paymentIntentId || null,
    sessionId: sessionId || null,
    transferId: transferId || null,
    chargeId: chargeId || null,
  });

  const data: Record<string, unknown> = {
    status: "PAID",
  };

  if (paymentIntentId) data.stripePaymentIntentId = paymentIntentId;
  if (sessionId) data.stripeSessionId = sessionId;
  if (transferId) data.stripeTransferId = transferId;

  const res = await (prisma as any).booking.updateMany({
    where: {
      id: bookingId,
      status: { notIn: ["CONFIRMED", "CANCELLED", "REFUNDED"] },
    },
    data,
  });

  console.log("[webhook][stripe] reconcile:markPaid:db", {
    bookingId,
    count: res?.count ?? null,
  });

  if (Number(res?.count ?? 0) > 0) {
    await notifyPendingAcceptance(req, bookingId);
  }
}

function computeConnectStatus(account: Stripe.Account) {
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const disabledReason = typeof account.requirements?.disabled_reason === "string" ? account.requirements.disabled_reason : "";
  const currentlyDue = Array.isArray(account.requirements?.currently_due) ? account.requirements.currently_due : [];
  if (chargesEnabled && payoutsEnabled) return "ENABLED" as const;
  if (disabledReason || currentlyDue.length > 0) return "RESTRICTED" as const;
  return "PENDING" as const;
}

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

    const stripeAccount = getStripeAccountHeader(req);

    console.log("[webhook][stripe] received", {
      signaturePrefix: `${signature.slice(0, 16)}...`,
      bytes: body.length,
      stripeAccount: stripeAccount || null,
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
    } catch (err) {
      console.error("[api][stripe][webhook] signature verification failed", err);
      return NextResponse.json({ ok: false, error: "INVALID_SIGNATURE" }, { status: 400 });
    }

    console.log("[webhook][stripe] event", {
      id: event.id,
      type: event.type,
      livemode: event.livemode,
      stripeAccount: stripeAccount || null,
    });

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const accountId = typeof account.id === "string" ? account.id : "";
      if (!accountId) {
        return NextResponse.json({ received: true, ignored: true, reason: "MISSING_ACCOUNT_ID" }, { status: 200 });
      }

      const status = computeConnectStatus(account);
      const db = prisma as any;
      await db.sitterProfile.updateMany({
        where: { stripeAccountId: accountId },
        data: {
          stripeAccountStatus: status,
          ...(status === "ENABLED" ? { stripeOnboardingCompletedAt: new Date() } : null),
        },
      });

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = typeof session.metadata?.bookingId === "string" ? session.metadata.bookingId : "";
      const sessionId = typeof session.id === "string" ? session.id : "";
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : "";

      if (!bookingId && !sessionId) {
        console.warn(`[webhook][stripe] event=checkout.session.completed missing bookingId+sessionId`);
        return NextResponse.json({ received: true, ignored: true, reason: "MISSING_BOOKING_ID" }, { status: 200 });
      }

      if (bookingId) {
        await markBookingPaid({
          req,
          bookingId,
          paymentIntentId: paymentIntentId || undefined,
          sessionId: sessionId || undefined,
          eventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
        });
      } else if (sessionId || paymentIntentId) {
        const res = await (prisma as any).booking.updateMany({
          where: {
            ...(sessionId ? { stripeSessionId: sessionId } : {}),
            ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
            status: { notIn: ["CONFIRMED", "CANCELLED", "REFUNDED"] },
          },
          data: {
            status: "PAID",
            ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
            ...(sessionId ? { stripeSessionId: sessionId } : {}),
          },
        });

        console.log("[webhook][stripe] checkout.session.completed fallback updateMany", {
          sessionId: sessionId || null,
          paymentIntentId: paymentIntentId || null,
          count: res?.count ?? null,
        });
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

      console.log("[webhook][stripe] payment_intent.succeeded", {
        bookingId,
        intentId: intent.id,
        livemode: event.livemode,
      });

      let transferId = "";
      try {
        const expanded = (await stripe.paymentIntents.retrieve(intent.id, { expand: ["charges.data.transfer"] })) as any;
        const charge = expanded?.charges?.data?.[0];
        const transfer = (charge as any)?.transfer;
        if (typeof transfer === "string") transferId = transfer;
        else if (transfer && typeof transfer.id === "string") transferId = transfer.id;
      } catch (err) {
        console.error("[api][stripe][webhook] expand transfer failed", { intentId: intent.id, err });
      }

      await markBookingPaid({
        req,
        bookingId,
        paymentIntentId: intent.id,
        transferId: transferId || undefined,
        eventId: event.id,
        eventType: event.type,
        livemode: event.livemode,
      });

      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (event.type === "charge.succeeded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : "";
      const chargeId = typeof charge.id === "string" ? charge.id : "";
      const bookingId = typeof (charge.metadata as any)?.bookingId === "string" ? (charge.metadata as any).bookingId : "";

      if (!paymentIntentId && !bookingId) {
        console.warn("[webhook][stripe] charge.succeeded missing paymentIntentId+bookingId", {
          chargeId: chargeId || null,
          objectKeys: safeObjectKeys(charge),
        });
        return NextResponse.json({ received: true, ignored: true, reason: "MISSING_PAYMENT_INTENT" }, { status: 200 });
      }

      let resolvedBookingId = bookingId;
      if (!resolvedBookingId && paymentIntentId) {
        try {
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
          resolvedBookingId = typeof intent.metadata?.bookingId === "string" ? intent.metadata.bookingId : "";
        } catch (err) {
          console.error("[api][stripe][webhook] charge.succeeded retrieve intent failed", {
            paymentIntentId,
            err,
          });
        }
      }

      if (!resolvedBookingId) {
        console.warn("[webhook][stripe] charge.succeeded bookingId missing", {
          chargeId: chargeId || null,
          paymentIntentId: paymentIntentId || null,
        });
        return NextResponse.json({ received: true, ignored: true, reason: "MISSING_BOOKING_ID" }, { status: 200 });
      }

      await markBookingPaid({
        req,
        bookingId: resolvedBookingId,
        paymentIntentId: paymentIntentId || undefined,
        chargeId: chargeId || undefined,
        eventId: event.id,
        eventType: event.type,
        livemode: event.livemode,
      });

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
