/* eslint-disable @typescript-eslint/no-explicit-any -- existing `as any` Prisma escape hatches predate the address field added in this commit; refactoring them out of scope here. */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestAdminAccess } from "@/lib/adminAuth";
import { getActiveContractAmendment, isContractVersionAtLeast } from "@/lib/contractAmendments";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const city = (req.nextUrl.searchParams.get("city") ?? "").trim();
    const verification = (req.nextUrl.searchParams.get("verification") ?? "").trim(); // optional

    const activeAmendment = await getActiveContractAmendment();

    const where: any = {
      sitterId: { not: null },
      sitterProfile: {
        published: true,
        ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        ...(verification ? { verificationStatus: verification } : {}),
      },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { sitterId: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const rows = await (prisma as any).user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        sitterId: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        sitterBookings: { select: { id: true } },
        reviewsReceived: { select: { id: true } },
        sitterProfile: {
          select: {
            displayName: true,
            city: true,
            postalCode: true,
            address: true,
            published: true,
            verificationStatus: true,
            verificationNotes: true,
            profileCompletion: true,
            lifecycleStatus: true,
            contractVersion: true,
            activationCodeIssuedAt: true,
            contractAccessTokenIssuedAt: true,
            contractAccessTokenExpiresAt: true,
            contractAmendmentAcceptances: activeAmendment
              ? {
                  where: { amendmentId: activeAmendment.id },
                  select: { acceptedAt: true, amendmentVersion: true },
                  take: 1,
                }
              : false,
          },
        },
      },
    });

    const items = rows.map((s: any) => {
      const acceptance = Array.isArray(s.sitterProfile?.contractAmendmentAcceptances) ? s.sitterProfile.contractAmendmentAcceptances[0] : null;
      const amendmentUpToDate = !activeAmendment
        ? true
        : isContractVersionAtLeast(s.sitterProfile?.contractVersion ?? null, activeAmendment.version) ||
          (acceptance?.acceptedAt && acceptance?.amendmentVersion === activeAmendment.version);

      return {
        id: String(s.id),
        sitterId: s.sitterId ? String(s.sitterId) : null,
        name: typeof s.name === "string" ? s.name : null,
        email: typeof s.email === "string" ? s.email : null,
        phone: typeof s.phone === "string" ? s.phone : null,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : new Date(s.createdAt).toISOString(),
        updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : new Date(s.updatedAt).toISOString(),
        counts: {
          bookings: Array.isArray(s.sitterBookings) ? s.sitterBookings.length : 0,
          reviews: Array.isArray(s.reviewsReceived) ? s.reviewsReceived.length : 0,
        },
        profile: s.sitterProfile
          ? {
              displayName: typeof s.sitterProfile.displayName === "string" ? s.sitterProfile.displayName : null,
              city: typeof s.sitterProfile.city === "string" ? s.sitterProfile.city : null,
              postalCode: typeof s.sitterProfile.postalCode === "string" ? s.sitterProfile.postalCode : null,
              address: typeof s.sitterProfile.address === "string" ? s.sitterProfile.address : null,
              published: Boolean(s.sitterProfile.published),
              verificationStatus: typeof s.sitterProfile.verificationStatus === "string" ? s.sitterProfile.verificationStatus : null,
              verificationNotes: typeof s.sitterProfile.verificationNotes === "string" ? s.sitterProfile.verificationNotes : null,
              profileCompletion: typeof s.sitterProfile.profileCompletion === "number" ? s.sitterProfile.profileCompletion : null,
              lifecycleStatus: typeof s.sitterProfile.lifecycleStatus === "string" ? s.sitterProfile.lifecycleStatus : null,
              contractVersion: typeof s.sitterProfile.contractVersion === "string" ? s.sitterProfile.contractVersion : null,
              activationCodeIssuedAt:
                s.sitterProfile.activationCodeIssuedAt instanceof Date
                  ? s.sitterProfile.activationCodeIssuedAt.toISOString()
                  : s.sitterProfile.activationCodeIssuedAt
                    ? new Date(s.sitterProfile.activationCodeIssuedAt).toISOString()
                    : null,
              contractAccessTokenIssuedAt:
                s.sitterProfile.contractAccessTokenIssuedAt instanceof Date
                  ? s.sitterProfile.contractAccessTokenIssuedAt.toISOString()
                  : s.sitterProfile.contractAccessTokenIssuedAt
                    ? new Date(s.sitterProfile.contractAccessTokenIssuedAt).toISOString()
                    : null,
              contractAccessTokenExpiresAt:
                s.sitterProfile.contractAccessTokenExpiresAt instanceof Date
                  ? s.sitterProfile.contractAccessTokenExpiresAt.toISOString()
                  : s.sitterProfile.contractAccessTokenExpiresAt
                    ? new Date(s.sitterProfile.contractAccessTokenExpiresAt).toISOString()
                    : null,
              amendmentUpToDate,
            }
          : null,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        activeAmendment: activeAmendment ? { id: activeAmendment.id, version: activeAmendment.version } : null,
        items,
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[api][admin][sitters][active][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

