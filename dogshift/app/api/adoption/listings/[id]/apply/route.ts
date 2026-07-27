import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { applicationCreateSchema } from "@/lib/validators/adoption";
import { snapshotAdopterDossier } from "@/lib/adoption/dossier";

export const runtime = "nodejs";

/**
 * POST — "Je souhaite adopter".
 *
 * The dossier is frozen into `answers` at submission time rather than joined
 * live: nLPD-wise the cédant must see exactly what was sent to them, and later
 * edits to the adopter's profile must not silently rewrite an application the
 * cédant already read.
 *
 * A thread is opened immediately, before any decision. Reachability is the
 * point of doing this on DogShift instead of by email.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(applicationCreateSchema, await req.json().catch(() => null), {
      route: "adoption.applications.create",
    });
    if (!parsed.ok) return parsed.response;

    const listing = await prisma.adoptionListing.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!listing || listing.status !== "PUBLISHED") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (listing.userId === user.id) {
      return NextResponse.json({ ok: false, error: "OWN_LISTING" }, { status: 409 });
    }

    const profile = await prisma.adopterProfile.findUnique({ where: { userId: user.id } });
    if (!profile || !profile.consentSharedAt) {
      // Without the dossier the cédant has nothing to decide on, and without
      // consent we have no legal basis to forward it.
      return NextResponse.json({ ok: false, error: "ADOPTER_PROFILE_REQUIRED" }, { status: 409 });
    }

    const existing = await prisma.adoptionApplication.findUnique({
      where: { listingId_userId: { listingId: id, userId: user.id } },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== "WITHDRAWN") {
      return NextResponse.json({ ok: false, error: "ALREADY_APPLIED", applicationId: existing.id }, { status: 409 });
    }

    const answers = snapshotAdopterDossier(profile);
    const message = parsed.data.message?.trim() || null;

    const application = existing
      ? await prisma.adoptionApplication.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            message,
            answers,
            withdrawnAt: null,
            respondedAt: null,
            declineReason: null,
          },
          select: { id: true, status: true, createdAt: true },
        })
      : await prisma.adoptionApplication.create({
          data: { listingId: id, userId: user.id, message, answers },
          select: { id: true, status: true, createdAt: true },
        });

    const thread = await prisma.adoptionThread.upsert({
      where: { applicationId: application.id },
      create: {
        applicationId: application.id,
        ...(message ? { lastMessageAt: new Date(), lastMessagePreview: message.slice(0, 140) } : {}),
      },
      update: {},
      select: { id: true },
    });

    // The intro message is also the first chat message, so the conversation
    // doesn't start empty for the cédant.
    if (message) {
      await prisma.adoptionMessage.create({
        data: { threadId: thread.id, senderId: user.id, body: message },
      });
    }

    return NextResponse.json({ ok: true, application, threadId: thread.id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/adoption/listings/[id]/apply]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.applications.create" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
