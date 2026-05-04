/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as null | {
      sitterId?: string;
      decision?: "approved" | "rejected";
      notes?: string;
    };

    const sitterId = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    const decision = body?.decision;
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : null;

    if (!sitterId || (decision !== "approved" && decision !== "rejected")) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const db = prisma as any;
    const profile = await db.sitterProfile.findFirst({
      where: { sitterId },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        pensionVerifStatus: decision,
        pensionPhotoReviewedAt: new Date(),
        pensionAdminNotes: notes,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][admin][pension-verifications][review]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
