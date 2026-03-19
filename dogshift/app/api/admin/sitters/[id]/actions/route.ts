import { VerificationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ActionType = "approve" | "reject" | "suspend" | "reactivate" | "publish" | "unpublish";

function parseAction(value: unknown): ActionType | null {
  if (value === "approve" || value === "reject" || value === "suspend" || value === "reactivate" || value === "publish" || value === "unpublish") {
    return value;
  }
  return null;
}

function actionAllowed(action: ActionType, published: boolean, verificationStatus: VerificationStatus) {
  if (action === "approve") return verificationStatus === VerificationStatus.pending || verificationStatus === VerificationStatus.rejected || verificationStatus === VerificationStatus.not_verified;
  if (action === "reject") return verificationStatus === VerificationStatus.pending || verificationStatus === VerificationStatus.approved;
  if (action === "suspend") return published && verificationStatus === VerificationStatus.approved;
  if (action === "reactivate") return !published && verificationStatus === VerificationStatus.approved;
  if (action === "publish") return !published && verificationStatus === VerificationStatus.approved;
  if (action === "unpublish") return published;
  return true;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as null | {
      action?: string;
      notes?: string;
    };

    const action = parseAction(body?.action);
    const notesRaw = typeof body?.notes === "string" ? body.notes.trim() : "";
    const notes = notesRaw ? notesRaw.slice(0, 2000) : null;

    if (!action) {
      return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
    }

    const sitter = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        sitterId: true,
        sitterProfile: {
          select: {
            id: true,
            published: true,
            verificationStatus: true,
            verificationNotes: true,
          },
        },
      },
    });

    if (!sitter?.sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const currentStatus = sitter.sitterProfile.verificationStatus;
    const currentPublished = sitter.sitterProfile.published;

    if (!actionAllowed(action, currentPublished, currentStatus)) {
      return NextResponse.json({ ok: false, error: "INVALID_STATE_TRANSITION" }, { status: 409 });
    }

    const data: {
      published?: boolean;
      publishedAt?: Date | null;
      verificationStatus?: VerificationStatus;
      verificationReviewedAt?: Date;
      verificationNotes?: string | null;
    } = {};

    if (action === "approve") {
      data.verificationStatus = VerificationStatus.approved;
      data.verificationReviewedAt = new Date();
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
    }

    if (action === "reject") {
      data.verificationStatus = VerificationStatus.rejected;
      data.verificationReviewedAt = new Date();
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
      data.published = false;
      data.publishedAt = null;
    }

    if (action === "suspend") {
      data.published = false;
      data.publishedAt = null;
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
    }

    if (action === "reactivate") {
      data.published = true;
      data.publishedAt = currentPublished ? undefined : new Date();
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
    }

    if (action === "publish") {
      data.published = true;
      data.publishedAt = currentPublished ? undefined : new Date();
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
    }

    if (action === "unpublish") {
      data.published = false;
      data.publishedAt = null;
      data.verificationNotes = notes ?? sitter.sitterProfile.verificationNotes ?? null;
    }

    const updatedProfile = await prisma.sitterProfile.update({
      where: { id: sitter.sitterProfile.id },
      data,
      select: {
        id: true,
        published: true,
        publishedAt: true,
        verificationStatus: true,
        verificationReviewedAt: true,
        verificationNotes: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        sitterId: sitter.id,
        profile: {
          id: updatedProfile.id,
          published: updatedProfile.published,
          publishedAt: updatedProfile.publishedAt instanceof Date ? updatedProfile.publishedAt.toISOString() : null,
          verificationStatus: updatedProfile.verificationStatus,
          verificationReviewedAt: updatedProfile.verificationReviewedAt instanceof Date ? updatedProfile.verificationReviewedAt.toISOString() : null,
          verificationNotes: updatedProfile.verificationNotes,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api][admin][sitters][actions] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
