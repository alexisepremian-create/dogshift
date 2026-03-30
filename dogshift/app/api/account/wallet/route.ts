import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

type BookingRow = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  service: string | null;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type WalletPayment = {
  bookingId: string;
  dateIso: string;
  amount: number;
  currency: string;
  status: string;
  service: string;
  url: string;
};

type WalletRefund = {
  bookingId: string;
  dateIso: string;
  amount: number;
  currency: string;
  status: "succeeded" | "failed";
  stripeRefundId: string;
  service: string;
  url: string;
};

type WalletHistoryItem =
  | {
      type: "payment";
      bookingId: string;
      dateIso: string;
      amount: number;
      currency: string;
      status: string;
      service: string;
      url: string;
    }
  | {
      type: "refund";
      bookingId: string;
      dateIso: string;
      amount: number;
      currency: string;
      status: "succeeded" | "failed";
      stripeRefundId: string;
      service: string;
      url: string;
    };

function baseUrlFromRequest(req: NextRequest) {
  const appUrl = (process.env.APP_URL || "").trim();
  if (appUrl) return appUrl.replace(/\/$/, "");

  const publicAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (publicAppUrl) return publicAppUrl.replace(/\/$/, "");

  const env = (process.env.NEXTAUTH_URL || "").trim();
  if (env) return env.replace(/\/$/, "");

  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
  const host =
    (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() ||
    (req.headers.get("host") || "").split(",")[0]?.trim() ||
    "";
  if (!host) return "";
  return `${proto}://${host}`;
}

function toIso(d: Date) {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function isPaidLike(status: string) {
  return status === "PAID" || status === "CONFIRMED" || status === "REFUNDED" || status === "REFUND_FAILED";
}

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const baseUrl = baseUrlFromRequest(req);
    const bookingUrl = (bookingId: string) => `/account/bookings?id=${encodeURIComponent(bookingId)}`;

    const rows = (await (prisma as any).booking.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        service: true,
        stripePaymentIntentId: true,
        stripeRefundId: true,
        refundedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })) as BookingRow[];

    const payments: WalletPayment[] = [];
    const refunds: WalletRefund[] = [];
    const history: WalletHistoryItem[] = [];

    let totalPaid = 0;
    let totalRefunded = 0;

    for (const b of Array.isArray(rows) ? rows : []) {
      const bookingId = String(b.id);
      const status = String(b.status ?? "");
      const amount = typeof b.amount === "number" && Number.isFinite(b.amount) ? b.amount : 0;
      const currency = typeof b.currency === "string" && b.currency.trim() ? b.currency.trim() : "chf";
      const paymentIntentId = typeof b.stripePaymentIntentId === "string" && b.stripePaymentIntentId.trim() ? b.stripePaymentIntentId.trim() : null;
      const refundId = typeof b.stripeRefundId === "string" && b.stripeRefundId.trim() ? b.stripeRefundId.trim() : null;
      const service = typeof b.service === "string" && b.service.trim() ? b.service.trim() : "Service";

      if (isPaidLike(status) && paymentIntentId) {
        totalPaid += amount;
        const dateIso = toIso(b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt));
        const item: WalletPayment = {
          bookingId,
          dateIso,
          amount,
          currency,
          status,
          service,
          url: bookingUrl(bookingId),
        };
        payments.push(item);
        history.push({ type: "payment", ...item });
      }

      if (status === "REFUNDED" && refundId) {
        totalRefunded += amount;
        const refundedAt = b.refundedAt instanceof Date ? b.refundedAt : b.refundedAt ? new Date(b.refundedAt) : null;
        const dateIso = refundedAt ? refundedAt.toISOString() : toIso(b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt));
        const r: WalletRefund = {
          bookingId,
          dateIso,
          amount,
          currency,
          status: "succeeded",
          stripeRefundId: refundId,
          service,
          url: bookingUrl(bookingId),
        };
        refunds.push(r);
        history.push({ type: "refund", ...r });
      }

      if (status === "REFUND_FAILED" && refundId) {
        const refundedAt = b.refundedAt instanceof Date ? b.refundedAt : b.refundedAt ? new Date(b.refundedAt) : null;
        const dateIso = refundedAt ? refundedAt.toISOString() : toIso(b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt));
        const r: WalletRefund = {
          bookingId,
          dateIso,
          amount,
          currency,
          status: "failed",
          stripeRefundId: refundId,
          service,
          url: bookingUrl(bookingId),
        };
        refunds.push(r);
        history.push({ type: "refund", ...r });
      }
    }

    history.sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());

    // Summary (centimes CHF, aligné UI « Total dépensé / Total remboursé / Coût net ») :
    // - totalPaid : somme booking.amount pour résas avec PI Stripe et statut PAID | CONFIRMED | REFUNDED | REFUND_FAILED
    // - totalRefunded : somme booking.amount pour statut REFUNDED avec stripeRefundId (remboursements réussis)
    // - netBalance : totalPaid - totalRefunded
    // Les entrées REFUND_FAILED n’entrent pas dans totalRefunded ; elles restent visibles dans history.

    return NextResponse.json(
      {
        ok: true,
        summary: {
          totalPaid,
          totalRefunded,
          netBalance: totalPaid - totalRefunded,
        },
        payments,
        refunds,
        history,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][account][wallet][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
