import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/inApp";
import { sendPushToUser } from "@/lib/push/send";
import { sendNativePushToUser } from "@/lib/push/native";
import { reportApiError } from "@/lib/observability/reportApiError";
import { selfieDue, reportDue, selfieKey, reportKey } from "@/lib/serviceReport/nudges";

export const runtime = "nodejs";

// Cron cadence — keep in sync with vercel.json (*/5 * * * *).
const TICK_MS = 5 * 60 * 1000;
const REPORT_GRACE_MS = 6 * 60 * 60 * 1000;

function readCronSecret(req: NextRequest) {
  const header = (req.headers.get("x-cron-secret") || "").trim();
  if (header) return header;
  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice("bearer ".length).trim();
  return "";
}

/** GET — Vercel cron. Nudges sitters: selfie at midpoint, report at the end. */
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const maintenanceKey = (process.env.MAINTENANCE_API_KEY || "").trim();
  if (!secret) return NextResponse.json({ ok: false, error: "MISSING_CRON_SECRET" }, { status: 500 });

  const provided = readCronSecret(req);
  if (!provided || (provided !== secret && (!maintenanceKey || provided !== maintenanceKey))) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const graceAgo = new Date(now.getTime() - REPORT_GRACE_MS);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  try {
    // Loosely pull CONFIRMED bookings that could be mid-service or just ended,
    // then decide precisely with the pure selfieDue/reportDue helpers.
    const candidates = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        OR: [
          { startAt: { lte: now }, endAt: { gte: graceAgo } },
          { startDate: { lte: now }, endDate: { gte: twoDaysAgo } },
        ],
      },
      select: {
        id: true,
        sitterId: true,
        service: true,
        serviceType: true,
        status: true,
        startAt: true,
        endAt: true,
        startDate: true,
        endDate: true,
        dogProfileId: true,
      },
      take: 200,
    });

    let selfies = 0;
    let reports = 0;
    let skipped = 0;

    // Resolve a sitter's User.id from the business sitterId, memoised per tick.
    const sitterUserCache = new Map<string, string | null>();
    const resolveSitterUserId = async (sitterId: string) => {
      if (sitterUserCache.has(sitterId)) return sitterUserCache.get(sitterId) ?? null;
      const u = await prisma.user.findUnique({ where: { sitterId }, select: { id: true } });
      const id = u?.id ?? null;
      sitterUserCache.set(sitterId, id);
      return id;
    };

    for (const b of candidates) {
      const wantSelfie = selfieDue(b, now, TICK_MS);
      const wantReport = reportDue(b, now, REPORT_GRACE_MS);
      if (!wantSelfie && !wantReport) continue;

      const sitterUserId = b.sitterId ? await resolveSitterUserId(b.sitterId) : null;
      if (!sitterUserId) {
        skipped += 1;
        continue;
      }

      const dog = b.dogProfileId
        ? await prisma.dogProfile.findUnique({ where: { id: b.dogProfileId }, select: { name: true } })
        : null;
      const dogLabel = dog?.name || "le chien";
      const composerUrl = `/rapport/${encodeURIComponent(b.id)}`;

      if (wantSelfie) {
        try {
          const created = await createNotification({
            userId: sitterUserId,
            type: "serviceReportSelfie",
            title: "C'est l'heure du selfie 📸",
            body: `Prends une photo de ${dogLabel} pour le rapport.`,
            entityId: b.id,
            url: composerUrl,
            metadata: { bookingId: b.id },
            idempotencyKey: selfieKey(b.id, now),
          });
          if (!("deduped" in created)) {
            selfies += 1;
            const payload = { title: "C'est l'heure du selfie 📸", body: `Prends une photo de ${dogLabel} pour le rapport.`, url: composerUrl, tag: selfieKey(b.id, now) };
            await Promise.allSettled([sendPushToUser(sitterUserId, payload), sendNativePushToUser(sitterUserId, payload)]);
          }
        } catch (err) {
          console.error("[cron][service-reports] selfie nudge failed", { bookingId: b.id, err: String(err) });
        }
      }

      if (wantReport) {
        try {
          const created = await createNotification({
            userId: sitterUserId,
            type: "serviceReportReminder",
            title: "Envoie le rapport 📝",
            body: `Le service de ${dogLabel} est terminé — envoie le rapport à son propriétaire.`,
            entityId: b.id,
            url: composerUrl,
            metadata: { bookingId: b.id },
            idempotencyKey: reportKey(b.id),
          });
          if (!("deduped" in created)) {
            reports += 1;
            const payload = { title: "Envoie le rapport 📝", body: `Le service de ${dogLabel} est terminé.`, url: composerUrl, tag: reportKey(b.id) };
            await Promise.allSettled([sendPushToUser(sitterUserId, payload), sendNativePushToUser(sitterUserId, payload)]);
          }
        } catch (err) {
          console.error("[cron][service-reports] report nudge failed", { bookingId: b.id, err: String(err) });
        }
      }
    }

    return NextResponse.json({ ok: true, processed: candidates.length, selfies, reports, skipped }, { status: 200 });
  } catch (err) {
    console.error("[cron][service-reports] error", err);
    reportApiError({ kind: "internal_error", route: "cron.service-reports" });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
