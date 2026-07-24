import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { publicReportPhotoPath } from "@/lib/reportPhotoMedia";

export const runtime = "nodejs";

/** GET — the owner's read-only view of a SENT service report for their booking. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user?.id) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, userId: true, service: true, serviceType: true, dogProfileId: true },
    });
    if (!booking || booking.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const report = await prisma.serviceReport.findUnique({
      where: { bookingId: id },
      include: { photos: { select: { id: true, r2Key: true, caption: true, position: true } } },
    });
    // Owners only ever see a report that the sitter has actually sent.
    if (!report || report.status !== "SENT") {
      return NextResponse.json({ ok: true, report: null });
    }

    const dog = booking.dogProfileId
      ? await prisma.dogProfile.findUnique({ where: { id: booking.dogProfileId }, select: { name: true } })
      : null;

    return NextResponse.json({
      ok: true,
      report: {
        id: report.id,
        status: report.status,
        note: report.note,
        peed: report.peed,
        pooed: report.pooed,
        drankWater: report.drankWater,
        ate: report.ate,
        played: report.played,
        mood: report.mood,
        energy: report.energy,
        incidents: report.incidents,
        distanceMeters: report.distanceMeters,
        routeJson: report.routeJson ?? null,
        sentAt: report.sentAt,
        dogName: dog?.name ?? null,
        photos: report.photos
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((p) => ({ id: p.id, url: publicReportPhotoPath(p.r2Key), caption: p.caption })),
      },
    });
  } catch (err) {
    console.error("[GET /api/account/bookings/[id]/report]", err);
    reportApiError({ kind: "internal_error", route: "account.booking.report.get" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
