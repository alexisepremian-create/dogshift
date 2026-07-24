import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { canSendReport } from "@/lib/serviceReport/eligibility";
import { presignGetObject } from "@/lib/r2";
import { sendEmail } from "@/lib/email/sendEmail";
import { buildServiceReportEmail } from "@/lib/email/serviceReportEmail";
import { buildRouteMapUrl } from "@/lib/serviceReport/routeStaticMap";
import type { LatLng } from "@/lib/serviceReport/track";
import { createNotification } from "@/lib/notifications/inApp";
import { sendPushToUser } from "@/lib/push/send";
import { sendNativePushToUser } from "@/lib/push/native";

export const runtime = "nodejs";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
const PHOTO_URL_TTL = 60 * 60 * 24; // 24h — email clients keep the message around.

function dateLabelFor(booking: {
  startAt: Date | null;
  endAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
}): string {
  if (booking.startAt && booking.endAt) {
    const day = new Intl.DateTimeFormat("fr-CH", { dateStyle: "long", timeZone: "Europe/Zurich" }).format(booking.startAt);
    const time = new Intl.DateTimeFormat("fr-CH", { timeStyle: "short", timeZone: "Europe/Zurich" }).format(booking.startAt);
    const endTime = new Intl.DateTimeFormat("fr-CH", { timeStyle: "short", timeZone: "Europe/Zurich" }).format(booking.endAt);
    return `${day} · ${time}–${endTime}`;
  }
  if (booking.startDate && booking.endDate) {
    const fmt = (d: Date) => new Intl.DateTimeFormat("fr-CH", { dateStyle: "long", timeZone: "Europe/Zurich" }).format(d);
    return `Du ${fmt(booking.startDate)} au ${fmt(booking.endDate)}`;
  }
  return "";
}

/** POST — finalize the report: mark SENT, then email + notify + push the owner. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user?.sitterId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        sitterId: true,
        status: true,
        service: true,
        serviceType: true,
        startAt: true,
        endAt: true,
        startDate: true,
        endDate: true,
        dogProfileId: true,
      },
    });
    if (!booking || booking.sitterId !== user.sitterId) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const elig = canSendReport(booking, user.sitterId, new Date());
    if (!elig.ok) {
      const status = elig.reason === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ ok: false, error: elig.reason }, { status });
    }

    const report = await prisma.serviceReport.findUnique({
      where: { bookingId: id },
      include: { photos: { select: { id: true, r2Key: true, position: true } } },
    });
    if (!report) return NextResponse.json({ ok: false, error: "NO_REPORT" }, { status: 400 });

    const now = new Date();
    const sent = await prisma.serviceReport.update({
      where: { bookingId: id },
      data: { status: "SENT", sentAt: report.sentAt ?? now },
    });

    // Resolve owner + dog + sitter display names.
    const [owner, dog, sitterProfile] = await Promise.all([
      prisma.user.findUnique({ where: { id: booking.userId }, select: { email: true, name: true } }),
      booking.dogProfileId
        ? prisma.dogProfile.findUnique({ where: { id: booking.dogProfileId }, select: { name: true } })
        : Promise.resolve(null),
      prisma.sitterProfile.findUnique({ where: { sitterId: user.sitterId }, select: { displayName: true } }),
    ]);

    const sitterName = sitterProfile?.displayName?.trim() || user.name || "Ton dogsitter";
    const dogName = dog?.name ?? null;
    const serviceLabel = booking.service || (booking.serviceType ?? "Service");
    const dateLabel = dateLabelFor(booking);

    // 24h presigned GET urls so email clients can render the photos directly.
    const orderedPhotos = report.photos.slice().sort((a, b) => a.position - b.position).slice(0, 8);
    const photoUrls: string[] = [];
    for (const p of orderedPhotos) {
      try {
        const { url } = await presignGetObject({ key: p.r2Key, expiresInSeconds: PHOTO_URL_TTL });
        photoUrls.push(url);
      } catch (err) {
        console.error("[report.send] presign photo failed", { photoId: p.id, err: String(err) });
      }
    }

    const reportUrl = `${APP_URL}/account/bookings?id=${encodeURIComponent(booking.id)}`;
    const routeMapUrl = Array.isArray(sent.routeJson) && (sent.routeJson as unknown[]).length >= 2
      ? buildRouteMapUrl({ route: sent.routeJson as unknown as LatLng[], baseUrl: APP_URL })
      : null;

    if (owner?.email) {
      const email = buildServiceReportEmail({
        dogName,
        sitterName,
        serviceLabel,
        dateLabel,
        report: {
          note: sent.note,
          peed: sent.peed,
          pooed: sent.pooed,
          drankWater: sent.drankWater,
          ate: sent.ate,
          played: sent.played,
          mood: sent.mood,
          energy: sent.energy,
          incidents: sent.incidents,
          distanceMeters: sent.distanceMeters,
        },
        photoUrls,
        routeMapUrl,
        reportUrl,
        baseUrl: APP_URL,
      });
      await sendEmail(
        { to: owner.email, subject: email.subject, text: email.text, html: email.html },
        { templateName: "service-report", context: "host.booking.report.send", targetUserId: booking.userId, metadata: { bookingId: booking.id } },
      ).catch((err) => {
        console.error("[report.send] email failed", { bookingId: booking.id, err: String(err) });
      });
    }

    const dogLabel = dogName || "ton chien";
    await createNotification({
      userId: booking.userId,
      type: "serviceReportReceived",
      title: `Rapport de service — ${dogLabel}`,
      body: `${sitterName} t'a envoyé le rapport de ${dogLabel}.`,
      entityId: booking.id,
      url: `/account/bookings?id=${encodeURIComponent(booking.id)}`,
      metadata: { bookingId: booking.id, reportId: sent.id },
      idempotencyKey: `serviceReportReceived:${sent.id}`,
    });

    // Push (web + native). Awaited — fire-and-forget is dropped on Vercel.
    const pushPayload = {
      title: "Rapport de service 📸",
      body: `${sitterName} t'a envoyé le rapport de ${dogLabel}.`,
      url: `/account/bookings?id=${encodeURIComponent(booking.id)}`,
      tag: `serviceReportReceived:${sent.id}`,
    };
    await Promise.allSettled([
      sendPushToUser(booking.userId, pushPayload),
      sendNativePushToUser(booking.userId, pushPayload),
    ]);

    return NextResponse.json({ ok: true, report: { id: sent.id, status: sent.status, sentAt: sent.sentAt } });
  } catch (err) {
    console.error("[POST /api/host/bookings/[id]/report/send]", err);
    reportApiError({ kind: "internal_error", route: "host.booking.report.send" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
