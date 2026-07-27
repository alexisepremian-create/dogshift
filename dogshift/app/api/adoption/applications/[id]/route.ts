import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { applicationDecisionSchema } from "@/lib/validators/adoption";
import { loadApplicationAccess } from "@/lib/adoption/access";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";
import { amicusDeadline, AMICUS_DECLARATION_DAYS } from "@/lib/adoption/legal";

export const runtime = "nodejs";

/** GET — one application. The frozen dossier is disclosed to the cédant only. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const access = await loadApplicationAccess(id, user.id);
    if (!access) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const row = await prisma.adoptionApplication.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        status: true,
        message: true,
        answers: true,
        declineReason: true,
        respondedAt: true,
        withdrawnAt: true,
        adoptedAt: true,
        amicusConfirmedAt: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        listing: { select: { id: true, dogName: true, photos: true, status: true, microchipNumber: true } },
        thread: { select: { id: true, lastMessageAt: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      role: access.isCedant ? "cedant" : "adopter",
      application: {
        id: row.id,
        status: row.status,
        message: row.message,
        // nLPD: only the cédant this dossier was submitted to sees it.
        dossier: access.isCedant ? row.answers : null,
        declineReason: row.declineReason,
        respondedAt: row.respondedAt,
        withdrawnAt: row.withdrawnAt,
        adoptedAt: row.adoptedAt,
        amicusConfirmedAt: row.amicusConfirmedAt,
        amicusDeadline: row.adoptedAt ? amicusDeadline(row.adoptedAt) : null,
        amicusDeadlineDays: AMICUS_DECLARATION_DAYS,
        createdAt: row.createdAt,
        adopter: access.isCedant ? { id: row.user.id, name: row.user.name } : null,
        thread: row.thread,
        listing: {
          id: row.listing.id,
          dogName: row.listing.dogName,
          status: row.listing.status,
          coverPhotoUrl: row.listing.photos.length > 0 ? publicDogPhotoPath(row.listing.photos[0]) : null,
          // The chip number is what both parties declare to AMICUS, so the
          // accepted adopter needs it — nobody else does.
          microchipNumber:
            access.isCedant || row.status === "ACCEPTED" ? row.listing.microchipNumber : null,
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/adoption/applications/[id]]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.applications.detail" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * PATCH — the cédant's decision.
 *
 * A refusal requires a reason (validated in the schema): "no answer" is the
 * behaviour adopters hate most about existing platforms, and an explained no is
 * what keeps them applying elsewhere instead of giving up.
 *
 * ACCEPTED moves the listing to PENDING, not ADOPTED: the cession happens
 * offline, and only the cédant confirming it (MARK_ADOPTED) closes the loop.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(applicationDecisionSchema, await req.json().catch(() => null), {
      route: "adoption.applications.decide",
    });
    if (!parsed.ok) return parsed.response;
    const { status, declineReason } = parsed.data;

    const access = await loadApplicationAccess(id, user.id);
    if (!access) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (!access.isCedant) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const current = access.application.status;
    if (current === "WITHDRAWN") {
      return NextResponse.json({ ok: false, error: "APPLICATION_WITHDRAWN" }, { status: 409 });
    }
    if (current === "DECLINED" && status !== "DECLINED") {
      return NextResponse.json({ ok: false, error: "ALREADY_DECLINED" }, { status: 409 });
    }

    const now = new Date();
    const application = await prisma.adoptionApplication.update({
      where: { id },
      data: {
        status,
        respondedAt: now,
        declineReason: status === "DECLINED" ? (declineReason ?? null) : null,
      },
      select: { id: true, status: true, respondedAt: true, declineReason: true },
    });

    if (status === "ACCEPTED" && access.application.listing.status === "PUBLISHED") {
      await prisma.adoptionListing.update({
        where: { id: access.application.listingId },
        data: { status: "PENDING" },
      });
    }

    return NextResponse.json({ ok: true, application });
  } catch (err) {
    console.error("[PATCH /api/adoption/applications/[id]]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.applications.decide" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** DELETE — the adopter withdraws. Kept as a row (the thread stays readable). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const access = await loadApplicationAccess(id, user.id);
    if (!access) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (!access.isAdopter) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    if (access.application.status === "WITHDRAWN") {
      return NextResponse.json({ ok: true });
    }

    const now = new Date();
    await prisma.adoptionApplication.update({
      where: { id },
      data: { status: "WITHDRAWN", withdrawnAt: now },
    });

    // A withdrawn accepted candidate must put the dog back on the feed.
    if (access.application.status === "ACCEPTED" && access.application.listing.status === "PENDING") {
      await prisma.adoptionListing.update({
        where: { id: access.application.listingId },
        data: { status: "PUBLISHED", lastConfirmedAt: now },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/adoption/applications/[id]]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.applications.withdraw" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
