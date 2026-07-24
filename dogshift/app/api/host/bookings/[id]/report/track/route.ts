import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { reportTrackSchema } from "@/lib/validators/serviceReport";
import { canEditReport } from "@/lib/serviceReport/eligibility";
import { cleanRoute, downsampleRoute, routeDistanceMeters, type LatLng } from "@/lib/serviceReport/track";

export const runtime = "nodejs";

const MAX_STORED_POINTS = 1000;

/** PUT — save the sitter's recorded GPS walk track onto the booking's report. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user?.sitterId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(reportTrackSchema, await req.json().catch(() => null), { route: "host.booking.report.track.put" });
    if (!parsed.ok) return parsed.response;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, userId: true, sitterId: true, status: true },
    });
    if (!booking || booking.sitterId !== user.sitterId) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    const elig = canEditReport(booking, user.sitterId);
    if (!elig.ok) return NextResponse.json({ ok: false, error: elig.reason }, { status: elig.reason === "FORBIDDEN" ? 403 : 400 });

    // Sanitize + compact server-side so a spiky client trace can't bloat the row
    // or skew the distance shown to the owner.
    const cleaned = cleanRoute(parsed.data.route as LatLng[]);
    const route = downsampleRoute(cleaned, MAX_STORED_POINTS);
    const distanceMeters = routeDistanceMeters(cleaned);

    const report = await prisma.serviceReport.upsert({
      where: { bookingId: id },
      create: {
        bookingId: id,
        sitterId: user.sitterId,
        ownerId: booking.userId,
        routeJson: route,
        distanceMeters,
        trackStartedAt: parsed.data.trackStartedAt ? new Date(parsed.data.trackStartedAt) : null,
        trackEndedAt: parsed.data.trackEndedAt ? new Date(parsed.data.trackEndedAt) : null,
      },
      update: {
        routeJson: route,
        distanceMeters,
        trackStartedAt: parsed.data.trackStartedAt ? new Date(parsed.data.trackStartedAt) : null,
        trackEndedAt: parsed.data.trackEndedAt ? new Date(parsed.data.trackEndedAt) : null,
      },
      select: { id: true, distanceMeters: true },
    });

    return NextResponse.json({ ok: true, reportId: report.id, distanceMeters: report.distanceMeters, points: route.length });
  } catch (err) {
    console.error("[PUT /api/host/bookings/[id]/report/track]", err);
    reportApiError({ kind: "internal_error", route: "host.booking.report.track.put" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
