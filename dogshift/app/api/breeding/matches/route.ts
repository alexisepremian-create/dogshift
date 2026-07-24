import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { otherSide } from "@/lib/breeding/matchAuth";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";

export const runtime = "nodejs";

const SIDE_SELECT = {
  id: true,
  userId: true,
  region: true,
  dog: { select: { name: true, breed: true, birthYear: true, sex: true, photoUrl: true } },
} as const;

/** GET — the caller's open matches, most-recently-active first. */
export async function GET() {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const rows = await prisma.match.findMany({
      where: { closedAt: null, OR: [{ dogA: { userId: user.id } }, { dogB: { userId: user.id } }] },
      include: {
        dogA: { select: SIDE_SELECT },
        dogB: { select: SIDE_SELECT },
        thread: { select: { id: true, lastMessageAt: true, lastMessagePreview: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const matches = rows.map((m) => {
      const other = otherSide(m, user.id);
      return {
        matchId: m.id,
        threadId: m.thread?.id ?? null,
        lastMessageAt: m.thread?.lastMessageAt ?? null,
        lastMessagePreview: m.thread?.lastMessagePreview ?? null,
        createdAt: m.createdAt,
        otherDog: {
          matingProfileId: other.id,
          dogName: other.dog.name,
          breed: other.dog.breed,
          birthYear: other.dog.birthYear,
          sex: other.dog.sex,
          region: other.region,
          photoUrl: other.dog.photoUrl ? publicDogPhotoPath(other.dog.photoUrl) : null,
        },
      };
    });

    // Most-recently-active first (a message beats an old empty match).
    matches.sort((a, b) => {
      const ta = (a.lastMessageAt ?? a.createdAt).valueOf();
      const tb = (b.lastMessageAt ?? b.createdAt).valueOf();
      return tb - ta;
    });

    return NextResponse.json({ ok: true, matches });
  } catch (err) {
    console.error("[GET /api/breeding/matches]", err);
    reportApiError({ kind: "internal_error", route: "breeding.matches.get" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
