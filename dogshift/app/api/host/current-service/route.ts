import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { isLive, serviceStart } from "@/lib/serviceReport/currentService";

export const runtime = "nodejs";

/** GET — the sitter's service happening right now (for the camera quick-attach). */
export async function GET() {
  try {
    const user = await getAuthedDbUser();
    if (!user?.sitterId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Loosely query plausibly-active CONFIRMED bookings, then filter precisely
    // with isLive() (which handles the Zurich end-of-day for daily services).
    const candidates = await prisma.booking.findMany({
      where: {
        sitterId: user.sitterId,
        status: "CONFIRMED",
        OR: [
          { startAt: { lte: now }, endAt: { gte: twoHoursAgo } },
          { startDate: { lte: now }, endDate: { gte: oneDayAgo } },
        ],
      },
      select: {
        id: true,
        userId: true,
        service: true,
        serviceType: true,
        status: true,
        startAt: true,
        endAt: true,
        startDate: true,
        endDate: true,
        dogProfileId: true,
        serviceReport: { select: { id: true, status: true } },
      },
      take: 20,
    });

    const live = candidates
      .filter((b) => isLive(b, now))
      .sort((a, b) => (serviceStart(b)?.getTime() ?? 0) - (serviceStart(a)?.getTime() ?? 0))[0];

    if (!live) return NextResponse.json({ ok: true, service: null });

    const dog = live.dogProfileId
      ? await prisma.dogProfile.findUnique({ where: { id: live.dogProfileId }, select: { name: true } })
      : null;

    return NextResponse.json({
      ok: true,
      service: {
        bookingId: live.id,
        service: live.service,
        serviceType: live.serviceType,
        startAt: live.startAt,
        endAt: live.endAt,
        startDate: live.startDate,
        endDate: live.endDate,
        dogName: dog?.name ?? null,
        reportId: live.serviceReport?.id ?? null,
        reportStatus: live.serviceReport?.status ?? null,
      },
    });
  } catch (err) {
    console.error("[GET /api/host/current-service]", err);
    reportApiError({ kind: "internal_error", route: "host.current-service.get" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
