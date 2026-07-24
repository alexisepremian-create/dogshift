import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { reportPhotoCommitSchema } from "@/lib/validators/serviceReport";
import { headObject } from "@/lib/r2";
import { publicReportPhotoPath, reportPhotoPrefix } from "@/lib/reportPhotoMedia";

export const runtime = "nodejs";

/** POST — record an uploaded photo on the booking's report (creating the report if needed). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user?.sitterId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(reportPhotoCommitSchema, await req.json().catch(() => null), {
      route: "host.booking.report.photo.commit",
    });
    if (!parsed.ok) return parsed.response;
    const { key, caption, lat, lng, takenAt } = parsed.data;

    // Ownership gate: the key must live under this sitter+booking prefix.
    if (!key.startsWith(reportPhotoPrefix(user.sitterId, id))) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, userId: true, sitterId: true, status: true },
    });
    if (!booking || booking.sitterId !== user.sitterId) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ ok: false, error: "NOT_CONFIRMED" }, { status: 400 });
    }

    try {
      await headObject({ key });
    } catch {
      return NextResponse.json({ ok: false, error: "UPLOAD_NOT_FOUND" }, { status: 400 });
    }

    // Ensure the report row exists (draft), then append the photo.
    const report = await prisma.serviceReport.upsert({
      where: { bookingId: id },
      create: { bookingId: id, sitterId: user.sitterId, ownerId: booking.userId },
      update: {},
      select: { id: true },
    });
    const position = await prisma.serviceReportPhoto.count({ where: { reportId: report.id } });
    const photo = await prisma.serviceReportPhoto.create({
      data: {
        reportId: report.id,
        r2Key: key,
        caption: caption ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        takenAt: takenAt ? new Date(takenAt) : null,
        position,
      },
      select: { id: true, r2Key: true, caption: true },
    });

    return NextResponse.json({
      ok: true,
      photo: { id: photo.id, url: publicReportPhotoPath(photo.r2Key), caption: photo.caption },
    });
  } catch (err) {
    console.error("[POST /api/host/bookings/[id]/report/photos/commit]", err);
    reportApiError({ kind: "internal_error", route: "host.booking.report.photo.commit" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
