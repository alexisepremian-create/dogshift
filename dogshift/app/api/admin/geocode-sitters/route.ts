import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { geocodeSwissLocation } from "@/lib/geocode";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const access = await getRequestAdminAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const profiles = await (prisma as any).sitterProfile.findMany({
      where: {
        published: true,
        OR: [{ lat: null }, { lng: null }],
      },
      select: {
        id: true,
        sitterId: true,
        city: true,
        postalCode: true,
      },
    });

    let geocoded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      const city = String(profile.city ?? "").trim();
      const postalCode = String(profile.postalCode ?? "").trim();
      if (!city && !postalCode) {
        failed++;
        errors.push(`${profile.sitterId}: no city/postalCode`);
        continue;
      }

      const coords = await geocodeSwissLocation({ city, postalCode });
      if (!coords) {
        failed++;
        errors.push(`${profile.sitterId}: geocode returned null (city="${city}", postalCode="${postalCode}")`);
        continue;
      }

      await (prisma as any).sitterProfile.update({
        where: { id: profile.id },
        data: { lat: coords.lat, lng: coords.lng },
      });
      geocoded++;
    }

    return NextResponse.json({
      ok: true,
      total: profiles.length,
      geocoded,
      failed,
      errors,
    });
  } catch (err) {
    console.error("[admin][geocode-sitters] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
