import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout, type EmailSummaryRow } from "@/lib/email/templates/layout";

export const runtime = "nodejs";

function readCronSecretFromRequest(req: NextRequest) {
  const header = (req.headers.get("x-cron-secret") || "").trim();
  if (header) return header;

  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  return "";
}

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

function formatDateTime(value: unknown) {
  const d = value instanceof Date ? value : value ? new Date(String(value)) : null;
  if (!d) return "";
  const ts = d.getTime();
  if (!Number.isFinite(ts)) return "";
  try {
    return new Intl.DateTimeFormat("fr-CH", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function formatMoney(amount: unknown, currency: unknown) {
  const a = typeof amount === "number" && Number.isFinite(amount) ? amount : NaN;
  const c = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "CHF";
  if (!Number.isFinite(a)) return "";
  return `${(a / 100).toFixed(2)} ${c}`;
}

function isPaidStatus(status: string) {
  return status === "PAID" || status === "CONFIRMED";
}

function isBlockedStatus(status: string) {
  return status === "CANCELLED" || status === "REFUNDED" || status === "REFUND_FAILED" || status === "PAYMENT_FAILED";
}

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "MISSING_CRON_SECRET" }, { status: 500 });
  }

  const provided = readCronSecretFromRequest(req);
  if (!provided || provided !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const baseUrl = baseUrlFromRequest(req);
  const logoUrl = baseUrl ? `${baseUrl}/dogshift-logo.png` : "";

  let processed = 0;
  let sent = 0;
  let skipped = 0;

  try {
    const bookings = await (prisma as any).booking.findMany({
      where: {
        endDate: { gte: windowStart, lt: windowEnd },
        reviewRequestEmailSentAt: null,
        status: { in: ["PAID", "CONFIRMED"] },
      },
      select: {
        id: true,
        userId: true,
        sitterId: true,
        status: true,
        service: true,
        startDate: true,
        endDate: true,
        amount: true,
        currency: true,
        user: { select: { id: true, email: true, name: true } },
        sitter: {
          select: {
            id: true,
            sitterId: true,
            name: true,
            sitterProfile: { select: { displayName: true } },
          },
        },
        review: { select: { id: true } },
      },
      take: 250,
      orderBy: { endDate: "asc" },
    });

    for (const b of bookings ?? []) {
      const bookingId = String(b.id);
      processed += 1;

      try {
        const status = String(b.status ?? "");
        if (!isPaidStatus(status) || isBlockedStatus(status)) {
          skipped += 1;
          continue;
        }

        if (b.review?.id) {
          skipped += 1;
          continue;
        }

        const ownerEmail = typeof b.user?.email === "string" ? b.user.email.trim() : "";
        if (!ownerEmail) {
          skipped += 1;
          continue;
        }

        const sitterName =
          (typeof b.sitter?.sitterProfile?.displayName === "string" && b.sitter.sitterProfile.displayName.trim()
            ? b.sitter.sitterProfile.displayName.trim()
            : null) ??
          (typeof b.sitter?.name === "string" && b.sitter.name.trim() ? b.sitter.name.trim() : "ton sitter");

        const reviewUrl = baseUrl ? `${baseUrl}/account/bookings/${encodeURIComponent(bookingId)}?review=1` : "";

        const rows: EmailSummaryRow[] = [];
        const service = typeof b.service === "string" && b.service.trim() ? b.service.trim() : "";
        const start = formatDateTime(b.startDate);
        const end = formatDateTime(b.endDate);
        const amount = formatMoney(b.amount, b.currency);
        if (service) rows.push({ label: "Service", value: service });
        if (start) rows.push({ label: "Début", value: start });
        if (end) rows.push({ label: "Fin", value: end });
        if (amount) rows.push({ label: "Montant", value: amount });
        rows.push({ label: "Référence", value: bookingId });

        const subject = `Comment s’est passée la prestation avec ${sitterName} ?`;

        const rendered = renderEmailLayout({
          logoUrl,
          title: "Noter votre sitter",
          subtitle: `Comment s’est passée la prestation avec ${sitterName} ?`,
          summaryTitle: "Résumé",
          summaryRows: rows,
          ctaLabel: reviewUrl ? "Laisser un avis" : undefined,
          ctaUrl: reviewUrl || undefined,
          footerText: "Votre avis aide la communauté DogShift.",
        });

        const text =
          `Bonjour,\n\n` +
          `Comment s’est passée la prestation avec ${sitterName} ?\n\n` +
          (reviewUrl ? `Laisser un avis : ${reviewUrl}\n\n` : "") +
          `Votre avis aide la communauté DogShift.\n\n` +
          `— DogShift\n`;

        await sendEmail({
          to: ownerEmail,
          subject,
          html: rendered.html,
          text,
        });

        await (prisma as any).booking.update({
          where: { id: bookingId },
          data: { reviewRequestEmailSentAt: new Date() },
          select: { id: true },
        });

        sent += 1;
      } catch (err) {
        console.error("[api][cron][review-requests] booking failed", { bookingId, err });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
        processed,
        sent,
        skipped,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][cron][review-requests] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
