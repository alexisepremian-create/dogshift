import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { isMatchParticipant, otherSide } from "@/lib/breeding/matchAuth";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";

export const runtime = "nodejs";

const SIDE_SELECT = {
  id: true,
  userId: true,
  region: true,
  bio: true,
  goal: true,
  dog: { select: { name: true, breed: true, birthYear: true, sex: true, photoUrl: true } },
} as const;

/** GET — detail of one match (the other dog + thread), if the caller is in it. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        dogA: { select: SIDE_SELECT },
        dogB: { select: SIDE_SELECT },
        thread: { select: { id: true } },
      },
    });
    if (!match || match.closedAt || !isMatchParticipant(match, user.id)) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const other = otherSide(match, user.id);
    return NextResponse.json({
      ok: true,
      match: {
        matchId: match.id,
        threadId: match.thread?.id ?? null,
        otherDog: {
          matingProfileId: other.id,
          dogName: other.dog.name,
          breed: other.dog.breed,
          birthYear: other.dog.birthYear,
          sex: other.dog.sex,
          region: other.region,
          bio: other.bio,
          goal: other.goal,
          photoUrl: other.dog.photoUrl ? publicDogPhotoPath(other.dog.photoUrl) : null,
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/breeding/matches/[id]]", err);
    reportApiError({ kind: "internal_error", route: "breeding.match.get" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** DELETE — unmatch (soft close). Either participant can end it. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const match = await prisma.match.findUnique({
      where: { id },
      select: { id: true, closedAt: true, dogA: { select: { userId: true } }, dogB: { select: { userId: true } } },
    });
    if (!match || !isMatchParticipant(match, user.id)) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (!match.closedAt) {
      await prisma.match.update({ where: { id }, data: { closedAt: new Date(), closedById: user.id } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/breeding/matches/[id]]", err);
    reportApiError({ kind: "internal_error", route: "breeding.match.delete" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
