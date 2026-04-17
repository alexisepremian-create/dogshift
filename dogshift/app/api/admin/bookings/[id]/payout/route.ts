import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestAdminAccess } from "@/lib/adminAuth";
import { recordBookingFinanceEvent } from "@/lib/financeEvents";

export const runtime = "nodejs";

type PayoutMethod = "STRIPE" | "MANUAL";
type PayoutStatus = "PENDING" | "PAID";

function normalizePayoutMethod(value: unknown): PayoutMethod | null {
  return value === "STRIPE" || value === "MANUAL" ? value : null;
}

function normalizePayoutStatus(value: unknown): PayoutStatus | null {
  return value === "PENDING" || value === "PAID" ? value : null;
}

function isMissingPayoutColumnsError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("payoutMethod") || msg.includes("payoutStatus") || msg.includes("paidAt");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;
    const bookingId = typeof id === "string" ? id.trim() : "";
    if (!bookingId) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        payoutMethod: true,
        payoutStatus: true,
        paidAt: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, booking }, { status: 200 });
  } catch (error) {
    console.error("[api][admin][bookings][payout][GET] error", error);
    if (isMissingPayoutColumnsError(error)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_REQUIRED", message: "Migration Prisma payout incomplète en production." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR", message: "Erreur interne." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;
    const bookingId = typeof id === "string" ? id.trim() : "";
    if (!bookingId) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { payoutMethod?: unknown; payoutStatus?: unknown } | null;
    const payoutMethod = normalizePayoutMethod(body?.payoutMethod);
    const payoutStatus = normalizePayoutStatus(body?.payoutStatus);

    if (!payoutMethod || !payoutStatus) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const existing = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: { id: true, payoutMethod: true, payoutStatus: true, paidAt: true, amount: true, currency: true },
    });
    if (!existing?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const paidAt = payoutStatus === "PAID" ? existing.paidAt ?? new Date() : null;

    const updated = await (prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        payoutMethod,
        payoutStatus,
        paidAt,
      },
      select: {
        id: true,
        payoutMethod: true,
        payoutStatus: true,
        paidAt: true,
        updatedAt: true,
      },
    });

    if (existing.payoutMethod !== updated.payoutMethod || existing.payoutStatus !== updated.payoutStatus) {
      await recordBookingFinanceEvent({
        bookingId,
        eventType: "PAYOUT_ADMIN_UPDATED",
        message: `Mise a jour admin payout: ${existing.payoutMethod}/${existing.payoutStatus} -> ${updated.payoutMethod}/${updated.payoutStatus}`,
        payoutMethod: updated.payoutMethod,
        payoutStatus: updated.payoutStatus,
        amount: existing.amount,
        currency: existing.currency,
        actorType: "ADMIN",
        actorId: access.userId ?? null,
        metadata: {
          from: { payoutMethod: existing.payoutMethod, payoutStatus: existing.payoutStatus },
          to: { payoutMethod: updated.payoutMethod, payoutStatus: updated.payoutStatus },
        },
      });
    }

    if (updated.payoutMethod === "MANUAL" && existing.payoutMethod !== "MANUAL") {
      await recordBookingFinanceEvent({
        bookingId,
        eventType: "PAYOUT_MARKED_MANUAL",
        message: "Payout marque comme manuel par admin.",
        payoutMethod: updated.payoutMethod,
        payoutStatus: updated.payoutStatus,
        amount: existing.amount,
        currency: existing.currency,
        actorType: "ADMIN",
        actorId: access.userId ?? null,
      });
    }

    if (updated.payoutStatus === "PAID" && existing.payoutStatus !== "PAID") {
      await recordBookingFinanceEvent({
        bookingId,
        eventType: "PAYOUT_MARKED_PAID",
        message: "Payout marque comme paye.",
        payoutMethod: updated.payoutMethod,
        payoutStatus: updated.payoutStatus,
        amount: existing.amount,
        currency: existing.currency,
        actorType: "ADMIN",
        actorId: access.userId ?? null,
        metadata: { paidAt: updated.paidAt ? new Date(updated.paidAt).toISOString() : null },
      });
    }

    return NextResponse.json({ ok: true, booking: updated, message: "États de paiement mis à jour." }, { status: 200 });
  } catch (error) {
    console.error("[api][admin][bookings][payout][PATCH] error", error);
    if (isMissingPayoutColumnsError(error)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_REQUIRED", message: "Migration Prisma payout incomplète en production." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR", message: "Erreur interne." }, { status: 500 });
  }
}
