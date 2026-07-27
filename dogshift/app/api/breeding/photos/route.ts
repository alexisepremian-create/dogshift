import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { matingPhotosSchema } from "@/lib/validators/breeding";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";

export const runtime = "nodejs";

/**
 * PUT — set the ordered photo gallery for a dog's mating profile.
 * Photos are uploaded via the existing /api/account/dogs/photo/presign flow
 * (keys live under `dog-photos/{userId}/`), then their ordered keys are saved
 * here. Reordering / deletion = send the new array. First key = primary.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(matingPhotosSchema, await req.json().catch(() => null), { route: "breeding.photos.put" });
    if (!parsed.ok) return parsed.response;
    const { dogProfileId, photos } = parsed.data;

    // Ownership: the dog must belong to the caller.
    const dog = await prisma.dogProfile.findUnique({ where: { id: dogProfileId }, select: { userId: true } });
    if (!dog || dog.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "DOG_NOT_FOUND" }, { status: 404 });
    }

    // Every key must live under this user's own photo prefix (prevents grabbing
    // another user's object by guessing a key).
    const prefix = `dog-photos/${user.id}/`;
    if (!photos.every((k) => k.startsWith(prefix))) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN_KEY" }, { status: 403 });
    }

    const profile = await prisma.matingProfile.upsert({
      where: { dogProfileId },
      create: { dogProfileId, userId: user.id, photos },
      update: { photos },
      select: { id: true, photos: true },
    });

    return NextResponse.json({
      ok: true,
      photos: profile.photos.map((k) => ({ key: k, url: publicDogPhotoPath(k) })),
    });
  } catch (err) {
    console.error("[PUT /api/breeding/photos]", err);
    reportApiError({ kind: "internal_error", route: "breeding.photos.put" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
