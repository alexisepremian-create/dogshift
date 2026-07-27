import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";
import { formatAgeFR } from "@/lib/adoption/feed";

export const runtime = "nodejs";

const LISTING_SUMMARY = {
  id: true,
  dogName: true,
  breed: true,
  birthDate: true,
  canton: true,
  city: true,
  photos: true,
  status: true,
} as const;

/**
 * GET ?role=adopter|cedant — the two inboxes.
 *
 * Split explicitly instead of merging: an adopter tracking their candidatures
 * and a cédant triaging candidates want opposite orderings and see different
 * fields. `role=cedant` is where the frozen dossier is disclosed.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const role = req.nextUrl.searchParams.get("role") === "cedant" ? "cedant" : "adopter";
    const now = new Date();

    if (role === "adopter") {
      const rows = await prisma.adoptionApplication.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          message: true,
          declineReason: true,
          respondedAt: true,
          withdrawnAt: true,
          adoptedAt: true,
          amicusConfirmedAt: true,
          createdAt: true,
          listing: { select: LISTING_SUMMARY },
          thread: { select: { id: true, lastMessageAt: true, lastMessagePreview: true } },
        },
      });

      return NextResponse.json({
        ok: true,
        role,
        applications: rows.map((row) => ({
          id: row.id,
          status: row.status,
          message: row.message,
          declineReason: row.declineReason,
          respondedAt: row.respondedAt,
          withdrawnAt: row.withdrawnAt,
          adoptedAt: row.adoptedAt,
          amicusConfirmedAt: row.amicusConfirmedAt,
          createdAt: row.createdAt,
          thread: row.thread,
          listing: {
            id: row.listing.id,
            dogName: row.listing.dogName,
            breed: row.listing.breed,
            ageLabel: formatAgeFR(row.listing.birthDate, now),
            canton: row.listing.canton,
            city: row.listing.city,
            status: row.listing.status,
            coverPhotoUrl:
              row.listing.photos.length > 0 ? publicDogPhotoPath(row.listing.photos[0]) : null,
          },
        })),
      });
    }

    const rows = await prisma.adoptionApplication.findMany({
      where: { listing: { userId: user.id } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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
        listing: { select: LISTING_SUMMARY },
        user: { select: { id: true, name: true } },
        thread: { select: { id: true, lastMessageAt: true, lastMessagePreview: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      role,
      applications: rows.map((row) => ({
        id: row.id,
        status: row.status,
        message: row.message,
        dossier: row.answers,
        declineReason: row.declineReason,
        respondedAt: row.respondedAt,
        withdrawnAt: row.withdrawnAt,
        adoptedAt: row.adoptedAt,
        amicusConfirmedAt: row.amicusConfirmedAt,
        createdAt: row.createdAt,
        thread: row.thread,
        adopter: { id: row.user.id, name: row.user.name },
        listing: {
          id: row.listing.id,
          dogName: row.listing.dogName,
          status: row.listing.status,
          coverPhotoUrl:
            row.listing.photos.length > 0 ? publicDogPhotoPath(row.listing.photos[0]) : null,
        },
      })),
    });
  } catch (err) {
    console.error("[GET /api/adoption/applications]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.applications.list" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
