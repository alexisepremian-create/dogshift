import { prisma } from "@/lib/prisma";

type FinanceActorType = "SYSTEM" | "ADMIN" | "STRIPE";
type PayoutMethod = "STRIPE" | "MANUAL";
type PayoutStatus = "PENDING" | "PAID";

type RecordBookingFinanceEventParams = {
  bookingId: string;
  eventType: string;
  message: string;
  payoutMethod?: PayoutMethod | null;
  payoutStatus?: PayoutStatus | null;
  amount?: number | null;
  currency?: string | null;
  stripeChargeId?: string | null;
  stripeTransferId?: string | null;
  stripePaymentIntentId?: string | null;
  metadata?: Record<string, unknown> | null;
  actorType?: FinanceActorType | null;
  actorId?: string | null;
};

export async function recordBookingFinanceEvent(params: RecordBookingFinanceEventParams): Promise<void> {
  try {
    const bookingId = typeof params.bookingId === "string" ? params.bookingId.trim() : "";
    const eventType = typeof params.eventType === "string" ? params.eventType.trim() : "";
    const message = typeof params.message === "string" ? params.message.trim() : "";
    if (!bookingId || !eventType || !message) return;

    await (prisma as any).bookingFinanceEvent.create({
      data: {
        bookingId,
        eventType,
        message,
        payoutMethod: params.payoutMethod ?? undefined,
        payoutStatus: params.payoutStatus ?? undefined,
        amount: typeof params.amount === "number" && Number.isFinite(params.amount) ? Math.round(params.amount) : undefined,
        currency: typeof params.currency === "string" && params.currency.trim() ? params.currency.trim().toLowerCase() : undefined,
        stripeChargeId: typeof params.stripeChargeId === "string" && params.stripeChargeId.trim() ? params.stripeChargeId.trim() : undefined,
        stripeTransferId: typeof params.stripeTransferId === "string" && params.stripeTransferId.trim() ? params.stripeTransferId.trim() : undefined,
        stripePaymentIntentId:
          typeof params.stripePaymentIntentId === "string" && params.stripePaymentIntentId.trim()
            ? params.stripePaymentIntentId.trim()
            : undefined,
        metadata: params.metadata ?? undefined,
        actorType: params.actorType ?? undefined,
        actorId: typeof params.actorId === "string" && params.actorId.trim() ? params.actorId.trim() : undefined,
      },
    });
  } catch (error) {
    console.error("[financeEvents] failed to record booking finance event", {
      bookingId: params.bookingId,
      eventType: params.eventType,
      error,
    });
  }
}
