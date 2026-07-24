import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { reportUpsertSchema } from "@/lib/validators/serviceReport";
import { canEditReport } from "@/lib/serviceReport/eligibility";
import { publicReportPhotoPath } from "@/lib/reportPhotoMedia";

export const runtime = "nodejs";

const BOOKING_SELECT = {
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
} as const;

function serializeReport(
  report: {
    id: string;
    status: string;
    note: string | null;
    peed: boolean | null;
    pooed: boolean | null;
    drankWater: boolean | null;
    ate: boolean | null;
    played: boolean | null;
    mood: string | null;
    energy: number | null;
    incidents: string | null;
    distanceMeters: number | null;
    routeJson: unknown;
    sentAt: Date | null;
    photos: { id: string; r2Key: string; caption: string | null; position: number }[];
  } | null,
) {
  if (!report) return null;
  return {
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
    photos: report.photos
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ id: p.id, url: publicReportPhotoPath(p.r2Key), caption: p.caption })),
  };
}

/** GET — the sitter's report for this booking (+ minimal booking context). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user?.sitterId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const booking = await prisma.booking.findUnique({ where: { id }, select: BOOKING_SELECT });
    if (!booking || booking.sitterId !== user.sitterId) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const report = await prisma.serviceReport.findUnique({
      where: { bookingId: id },
      include: { photos: { select: { id: true, r2Key: true, caption: true, position: true } } },
    });
    const dog = booking.dogProfileId
      ? await prisma.dogProfile.findUnique({ where: { id: booking.dogProfileId }, select: { name: true } })
      : null;

    return NextResponse.json({
      ok: true,
      report: serializeReport(report),
      booking: {
        id: booking.id,
        service: booking.service,
        serviceType: booking.serviceType,
        startAt: booking.startAt,
        endAt: booking.endAt,
        startDate: booking.startDate,
        endDate: booking.endDate,
        dogName: dog?.name ?? null,
      },
    });
  } catch (err) {
    console.error("[GET /api/host/bookings/[id]/report]", err);
    reportApiError({ kind: "internal_error", route: "host.booking.report.get" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** PUT — upsert the DRAFT checklist/note. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user?.sitterId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(reportUpsertSchema, await req.json().catch(() => null), { route: "host.booking.report.put" });
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

    const d = parsed.data;
    const data = {
      note: d.note ?? null,
      peed: d.peed ?? null,
      pooed: d.pooed ?? null,
      drankWater: d.drankWater ?? null,
      ate: d.ate ?? null,
      played: d.played ?? null,
      mood: d.mood ?? null,
      energy: d.energy ?? null,
      incidents: d.incidents ?? null,
    };
    const report = await prisma.serviceReport.upsert({
      where: { bookingId: id },
      create: { bookingId: id, sitterId: user.sitterId, ownerId: booking.userId, ...data },
      update: data,
      include: { photos: { select: { id: true, r2Key: true, caption: true, position: true } } },
    });

    return NextResponse.json({ ok: true, report: serializeReport(report) });
  } catch (err) {
    console.error("[PUT /api/host/bookings/[id]/report]", err);
    reportApiError({ kind: "internal_error", route: "host.booking.report.put" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
