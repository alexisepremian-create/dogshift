import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { adopterProfileSchema } from "@/lib/validators/adoption";

export const runtime = "nodejs";

/**
 * The reusable adopter dossier. Filled once, snapshotted into every application
 * — the single feature adopters on PetRescue/Petfinder ask for, because
 * re-typing the same twenty answers per shelter is what kills applications.
 */

/** GET — the caller's dossier, plus what we can pre-fill from their DogShift history. */
export async function GET() {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const [profile, dogCount, completedBookings] = await Promise.all([
      prisma.adopterProfile.findUnique({ where: { userId: user.id } }),
      prisma.dogProfile.count({ where: { userId: user.id } }),
      prisma.booking.count({ where: { userId: user.id, status: { in: ["CONFIRMED", "PAID"] } } }),
    ]);

    return NextResponse.json({
      ok: true,
      profile,
      // Soft signals a cédant can weigh: this adopter already has dogs on the
      // platform and has trusted sitters with them.
      trustSignals: { dogCount, completedBookings },
    });
  } catch (err) {
    console.error("[GET /api/adoption/adopter-profile]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.adopterProfile.get" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** PUT — create or replace the dossier. */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(adopterProfileSchema, await req.json().catch(() => null), {
      route: "adoption.adopterProfile.put",
    });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const existing = await prisma.adopterProfile.findUnique({
      where: { userId: user.id },
      select: { consentSharedAt: true, completedAt: true },
    });

    const now = new Date();
    // nLPD: consent is a dated fact, not a checkbox. Editing the dossier must
    // not rewrite when consent was originally given; withdrawing clears it.
    const consentSharedAt = body.consentShared ? (existing?.consentSharedAt ?? now) : null;

    const data = {
      housingType: body.housingType,
      isHomeOwner: body.isHomeOwner,
      landlordApproval: body.isHomeOwner ? null : (body.landlordApproval ?? null),
      hasGarden: body.hasGarden ?? false,
      gardenFenced: body.hasGarden ? (body.gardenFenced ?? null) : null,
      householdAdults: body.householdAdults,
      householdChildren: body.householdChildren,
      youngestChildAge: body.householdChildren > 0 ? (body.youngestChildAge ?? null) : null,
      hasOtherDogs: body.hasOtherDogs ?? false,
      hasCats: body.hasCats ?? false,
      otherPetsNote: body.otherPetsNote ?? null,
      hoursAlonePerDay: body.hoursAlonePerDay ?? null,
      experienceLevel: body.experienceLevel,
      previousDogsNote: body.previousDogsNote ?? null,
      activityLevel: body.activityLevel ?? null,
      canton: body.canton ?? null,
      city: body.city ?? null,
      motivation: body.motivation ?? null,
      consentSharedAt,
      completedAt: body.consentShared ? (existing?.completedAt ?? now) : null,
    };

    const profile = await prisma.adopterProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("[PUT /api/adoption/adopter-profile]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.adopterProfile.put" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
