import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { listingActionSchema } from "@/lib/validators/adoption";

export const runtime = "nodejs";

/**
 * POST — the cédant's lifecycle actions on their own listing.
 *
 * `CONFIRM_AVAILABLE` exists because stale listings are the single loudest
 * complaint about every adoption platform: the freshness cron (PR4) nudges,
 * this bumps `lastConfirmedAt` and keeps the ad out of the auto-archive sweep.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(listingActionSchema, await req.json().catch(() => null), {
      route: "adoption.listings.actions",
    });
    if (!parsed.ok) return parsed.response;
    const { action, applicationId } = parsed.data;

    const row = await prisma.adoptionListing.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!row || row.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const now = new Date();

    if (action === "CONFIRM_AVAILABLE") {
      if (row.status !== "PUBLISHED") {
        return NextResponse.json({ ok: false, error: "NOT_PUBLISHED" }, { status: 409 });
      }
      const updated = await prisma.adoptionListing.update({
        where: { id },
        data: { lastConfirmedAt: now },
        select: { id: true, status: true, lastConfirmedAt: true },
      });
      return NextResponse.json({ ok: true, listing: updated });
    }

    if (action === "MARK_ADOPTED") {
      if (row.status === "ADOPTED") {
        return NextResponse.json({ ok: false, error: "ALREADY_ADOPTED" }, { status: 409 });
      }

      // Closing the loop matters: the winning application flips to ACCEPTED and
      // every other pending candidate is declined, so nobody is left waiting on
      // a dog that is gone.
      const winner = applicationId
        ? await prisma.adoptionApplication.findUnique({
            where: { id: applicationId },
            select: { id: true, listingId: true },
          })
        : null;
      if (applicationId && (!winner || winner.listingId !== id)) {
        return NextResponse.json({ ok: false, error: "APPLICATION_NOT_FOUND" }, { status: 404 });
      }

      const [listing] = await prisma.$transaction([
        prisma.adoptionListing.update({
          where: { id },
          data: { status: "ADOPTED", adoptedAt: now },
          select: { id: true, status: true, adoptedAt: true },
        }),
        ...(winner
          ? [
              prisma.adoptionApplication.update({
                where: { id: winner.id },
                data: { status: "ACCEPTED", adoptedAt: now, respondedAt: now },
              }),
            ]
          : []),
        prisma.adoptionApplication.updateMany({
          where: {
            listingId: id,
            status: { in: ["PENDING", "SHORTLISTED"] },
            ...(winner ? { id: { not: winner.id } } : {}),
          },
          data: {
            status: "DECLINED",
            respondedAt: now,
            declineReason: "Le chien a été adopté.",
          },
        }),
      ]);

      return NextResponse.json({ ok: true, listing });
    }

    if (action === "ARCHIVE") {
      if (row.status === "ADOPTED") {
        return NextResponse.json({ ok: false, error: "ALREADY_ADOPTED" }, { status: 409 });
      }
      const [listing] = await prisma.$transaction([
        prisma.adoptionListing.update({
          where: { id },
          data: { status: "ARCHIVED", archivedAt: now },
          select: { id: true, status: true, archivedAt: true },
        }),
        prisma.adoptionApplication.updateMany({
          where: { listingId: id, status: { in: ["PENDING", "SHORTLISTED"] } },
          data: {
            status: "DECLINED",
            respondedAt: now,
            declineReason: "L'annonce a été retirée.",
          },
        }),
      ]);
      return NextResponse.json({ ok: true, listing });
    }

    // UNARCHIVE — back to DRAFT, never straight to PUBLISHED: the legality
    // check has to run again through /publish (the 56-day rule and the breed
    // matrix may both have moved since).
    if (row.status !== "ARCHIVED") {
      return NextResponse.json({ ok: false, error: "NOT_ARCHIVED" }, { status: 409 });
    }
    const listing = await prisma.adoptionListing.update({
      where: { id },
      data: { status: "DRAFT", archivedAt: null },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    console.error("[POST /api/adoption/listings/[id]/actions]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.listings.actions" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
