/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { pluralFR, tgFooter, tgHeader, tgMessage, tgSection } from "@/lib/telegram/format";

export const runtime = "nodejs";

const MONTH_NAMES_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function readCronSecretFromRequest(req: NextRequest) {
  const header = (req.headers.get("x-cron-secret") || "").trim();
  if (header) return header;

  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  return "";
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
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const monthStart = new Date(prevYear, prevMonth, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthName = MONTH_NAMES_FR[prevMonth] ?? String(prevMonth + 1);

  try {
    const sitterProfiles = await (prisma as any).sitterProfile.findMany({
      where: { published: true },
      select: { sitterId: true, userId: true },
      take: 500,
    });

    let processed = 0;
    let sent = 0;
    let skipped = 0;

    for (const sp of sitterProfiles ?? []) {
      const sitterId = String(sp.sitterId);
      const userId = String(sp.userId);
      processed += 1;

      try {
        const bookings = await (prisma as any).booking.findMany({
          where: {
            sitterId,
            status: { in: ["PAID", "CONFIRMED"] },
            endDate: { gte: monthStart, lt: monthEnd },
          },
          select: {
            id: true,
            amount: true,
            currency: true,
            sitterPayoutAmount: true,
            platformFeeAmount: true,
            startDate: true,
            endDate: true,
          },
        });

        if (!bookings || bookings.length === 0) {
          skipped += 1;
          continue;
        }

        let totalHours = 0;
        let netRevenueCents = 0;
        const currency = typeof bookings[0]?.currency === "string" ? bookings[0].currency : "CHF";

        for (const b of bookings) {
          const start = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
          const end = b.endDate instanceof Date ? b.endDate : new Date(b.endDate);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            totalHours += Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
          }
          const payout = typeof b.sitterPayoutAmount === "number" ? b.sitterPayoutAmount : 0;
          const gross = typeof b.amount === "number" ? b.amount : 0;
          const commission = typeof b.platformFeeAmount === "number" ? b.platformFeeAmount : 0;
          netRevenueCents += payout > 0 ? payout : Math.max(0, gross - commission);
        }

        const reviews = await (prisma as any).review.findMany({
          where: {
            sitterId,
            createdAt: { gte: monthStart, lt: monthEnd },
          },
          select: { rating: true },
        });

        let averageRating: number | null = null;
        if (reviews && reviews.length > 0) {
          const sum = reviews.reduce((acc: number, r: any) => acc + (typeof r.rating === "number" ? r.rating : 0), 0);
          averageRating = Math.round((sum / reviews.length) * 10) / 10;
        }

        const res = await sendNotificationEmail({
          req,
          recipientUserId: userId,
          key: "sitterMonthlyRecap",
          entityId: `recap:${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`,
          payload: {
            kind: "sitterMonthlyRecap",
            month: monthName,
            year: prevYear,
            totalBookings: bookings.length,
            totalHours: Math.round(totalHours),
            netRevenueCents,
            currency,
            averageRating,
          },
        });
        if (res.ok && !res.skipped) sent += 1;
        if (res.ok && res.skipped) skipped += 1;
      } catch (err) {
        console.error("[api][cron][sitter-monthly-recap] sitter failed", { sitterId, err });
      }
    }

    // Telegram récap vers bot relances — 1 message par mois, low noise.
    // AWAITED (cron + fire-and-forget = dropped par Vercel).
    let telegramSent = false;
    if (processed > 0) {
      const message = tgMessage([
        tgHeader("📊", `Recap mensuel sitters — ${monthName} ${prevYear}`),
        [
          tgSection("📤", "Envoi"),
          `${pluralFR(processed, "sitter publié", "sitters publiés")} examiné${processed !== 1 ? "s" : ""}`,
          `✅ ${pluralFR(sent, "recap envoyé", "recaps envoyés")}${skipped > 0 ? ` · ⏭ ${pluralFR(skipped, "ignoré")} (0 booking sur la période)` : ""}`,
        ],
        tgFooter(),
      ]);
      telegramSent = await sendTelegramMessage(message, {
        bot: "relances",
        parseMode: "HTML",
      });
    }

    return NextResponse.json(
      { ok: true, month: monthName, year: prevYear, processed, sent, skipped, telegramSent },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api][cron][sitter-monthly-recap] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
