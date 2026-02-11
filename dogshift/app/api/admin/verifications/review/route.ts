import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function requireAdmin(req: NextRequest) {
  const expected = (process.env.HOST_ADMIN_CODE ?? "").trim();
  const supplied = req.headers.get("x-admin-code")?.trim() ?? "";
  if (!expected || !supplied || supplied !== expected) {
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { userId } = await auth();

    const body = (await req.json().catch(() => null)) as null | {
      sitterId?: string;
      decision?: "approved" | "rejected";
      notes?: string;
    };

    const sitterId = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    const decision = body?.decision;
    const notesRaw = typeof body?.notes === "string" ? body.notes : "";
    const notes = notesRaw.trim() ? notesRaw.trim().slice(0, 2000) : null;

    if (!sitterId || (decision !== "approved" && decision !== "rejected")) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const db = prisma as unknown as {
      sitterProfile: {
        findFirst: (args: unknown) => Promise<{ id: string; sitterId: string; verificationStatus?: string | null } | null>;
        update: (args: unknown) => Promise<unknown>;
      };
      verificationAccessLog: { create: (args: unknown) => Promise<unknown> };
    };

    const sitterProfile = await db.sitterProfile.findFirst({
      where: { sitterId },
      select: { id: true, sitterId: true, verificationStatus: true },
    });

    if (!sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const prevStatus = typeof sitterProfile.verificationStatus === "string" ? sitterProfile.verificationStatus : "not_verified";
    if (prevStatus !== "pending") {
      return NextResponse.json({ ok: false, error: "NOT_PENDING" }, { status: 409 });
    }

    await db.sitterProfile.update({
      where: { id: sitterProfile.id },
      data: {
        verificationStatus: decision,
        verificationReviewedAt: new Date(),
        verificationNotes: notes,
      },
    });

    await db.verificationAccessLog.create({
      data: {
        sitterProfileId: sitterProfile.id,
        sitterId: sitterProfile.sitterId,
        action: decision === "approved" ? "review_approved" : "review_rejected",
        fileKey: null,
        adminClerkUserId: userId ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api][admin][verifications][review] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
