import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { matingEnableSchema } from "@/lib/validators/breeding";
import { canEnableMating } from "@/lib/breeding/eligibility";

export const runtime = "nodejs";

const DOG_SELECT = {
  id: true,
  name: true,
  breed: true,
  sex: true,
  photoUrl: true,
  neutered: true,
  birthYear: true,
  weightKg: true,
} as const;

/** GET — the caller's mating profiles (one per dog), joined with dog basics. */
export async function GET() {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const profiles = await prisma.matingProfile.findMany({
      where: { userId: user.id },
      include: { dog: { select: DOG_SELECT } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ ok: true, profiles });
  } catch (err) {
    console.error("[GET /api/breeding/profile]", err);
    reportApiError({ kind: "internal_error", route: "breeding.profile.get" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** PUT — enable/update the mating profile for one of the caller's dogs. */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(matingEnableSchema, await req.json().catch(() => null), {
      route: "breeding.profile.put",
    });
    if (!parsed.ok) return parsed.response;
    const { dogProfileId, enabled, goal, bio, region, acceptTerms } = parsed.data;

    const dog = await prisma.dogProfile.findUnique({
      where: { id: dogProfileId },
      select: { id: true, userId: true, sex: true },
    });
    if (!dog || dog.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "DOG_NOT_FOUND" }, { status: 404 });
    }

    if (enabled) {
      const elig = canEnableMating({ sex: dog.sex });
      if (!elig.ok) return NextResponse.json({ ok: false, error: elig.reason }, { status: 400 });
    }

    // Stamp the legal acceptance once and keep it thereafter.
    const existing = await prisma.matingProfile.findUnique({
      where: { dogProfileId },
      select: { acceptedTermsAt: true },
    });
    const acceptedTermsAt = existing?.acceptedTermsAt ?? (acceptTerms ? new Date() : null);

    const profile = await prisma.matingProfile.upsert({
      where: { dogProfileId },
      create: {
        dogProfileId,
        userId: user.id,
        enabled,
        goal,
        bio: bio ?? null,
        region: region ?? null,
        acceptedTermsAt,
      },
      update: { enabled, goal, bio: bio ?? null, region: region ?? null, acceptedTermsAt },
    });
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    console.error("[PUT /api/breeding/profile]", err);
    reportApiError({ kind: "internal_error", route: "breeding.profile.put" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** DELETE ?dogProfileId=… — full opt-out / erasure of a dog's mating profile. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const dogProfileId = new URL(req.url).searchParams.get("dogProfileId");
    if (!dogProfileId) {
      return NextResponse.json({ ok: false, error: "DOG_PROFILE_ID_REQUIRED" }, { status: 400 });
    }

    const mp = await prisma.matingProfile.findUnique({
      where: { dogProfileId },
      select: { userId: true },
    });
    if (!mp || mp.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    await prisma.matingProfile.delete({ where: { dogProfileId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/breeding/profile]", err);
    reportApiError({ kind: "internal_error", route: "breeding.profile.delete" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
