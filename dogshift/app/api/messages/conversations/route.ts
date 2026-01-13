import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

type Body = {
  otherUserId?: unknown;
  sitterId?: unknown;
  bookingId?: unknown;
};

async function resolveSitterKey(input: string) {
  const raw = input.trim();
  if (!raw) return null;

  // 1) Accept a public sitterId (s-...) stored on SitterProfile.sitterId
  // Conversation.sitterId references User.sitterId, so we also ensure User.sitterId is populated.
  if (raw.startsWith("s-")) {
    const profile = await prisma.sitterProfile.findUnique({ where: { sitterId: raw }, select: { userId: true, sitterId: true } });
    if (!profile) return null;

    const user = await prisma.user.findUnique({ where: { id: profile.userId }, select: { id: true, sitterId: true } });
    if (!user?.id) return null;

    if (!user.sitterId || !user.sitterId.trim()) {
      // Keep DB consistent: Conversation.sitterId and Booking.sitterId require User.sitterId
      await prisma.user.update({ where: { id: user.id }, data: { sitterId: profile.sitterId }, select: { id: true } });
    }

    return { userId: user.id, sitterId: profile.sitterId };
  }

  // 2) Accept either User.id or User.sitterId
  const user =
    (await prisma.user.findUnique({ where: { id: raw }, select: { id: true, sitterId: true, sitterProfile: { select: { sitterId: true } } } })) ??
    (await prisma.user.findUnique({ where: { sitterId: raw }, select: { id: true, sitterId: true, sitterProfile: { select: { sitterId: true } } } }));

  const userId = typeof user?.id === "string" && user.id.trim() ? user.id.trim() : null;
  if (!userId) return null;

  const sitterIdFromUser = typeof user?.sitterId === "string" && user.sitterId.trim() ? user.sitterId.trim() : null;
  const sitterIdFromProfile = typeof user?.sitterProfile?.sitterId === "string" && user.sitterProfile.sitterId.trim() ? user.sitterProfile.sitterId.trim() : null;
  const sitterId = sitterIdFromUser ?? sitterIdFromProfile;
  if (!sitterId) return null;

  if (!sitterIdFromUser && sitterIdFromProfile) {
    await prisma.user.update({ where: { id: userId }, data: { sitterId: sitterIdFromProfile }, select: { id: true } });
  }

  return { userId, sitterId };
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (process.env.NODE_ENV !== "production") {
      console.log("[api][messages/conversations] entered", { clerkUserId: clerkUserId ?? null });
    }
    const ownerId = await resolveDbUserId(req);
    if (!ownerId) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[api][messages/conversations] unauthorized: no ownerId");
        console.log("[api][messages/conversations] API END", { status: 401, error: "UNAUTHORIZED", step: "resolveDbUserId" });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED", step: "resolveDbUserId" }, { status: 401 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[api][messages/conversations] resolved ownerId", { ownerId, clerkUserId: clerkUserId ?? null });
    }

    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!owner) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[api][messages/conversations] unauthorized: owner not found", { ownerId });
        console.log("[api][messages/conversations] API END", { status: 401, error: "USER_NOT_FOUND", step: "loadOwner" });
      }
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND", step: "loadOwner" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId.trim() : "";

    const otherUserId = typeof body?.otherUserId === "string" ? body.otherUserId.trim() : "";
    const sitterIdInput = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";

    if (process.env.NODE_ENV !== "production") {
      console.log("[api][messages/conversations] body", {
        ownerId,
        clerkUserId: clerkUserId ?? null,
        otherUserId,
        sitterId: sitterIdInput,
        bookingId: bookingId || null,
      });
    }

    if (!otherUserId && !sitterIdInput) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[api][messages/conversations] API END", { status: 400, error: "MISSING_SITTER_ID", step: "validateBody" });
      }
      return NextResponse.json(
        { ok: false, error: "MISSING_SITTER_ID", step: "validateBody", details: { required: ["sitterId"], received: Object.keys(body ?? {}) } },
        { status: 400 }
      );
    }

    const sitter = await (async () => {
      if (otherUserId) return resolveSitterKey(otherUserId);
      if (sitterIdInput) return resolveSitterKey(sitterIdInput);
      return null;
    })();

    if (!sitter) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[api][messages/conversations] sitter not found", { otherUserId, sitterIdInput });
        console.log("[api][messages/conversations] API END", { status: 400, error: "SITTER_NOT_FOUND", step: "resolveSitterKey" });
      }
      return NextResponse.json(
        {
          ok: false,
          error: "SITTER_NOT_FOUND",
          step: "resolveSitterKey",
          details: {
            otherUserId: otherUserId || null,
            sitterId: sitterIdInput || null,
            hint: "Provide a valid public sitterId (s-...) or a valid User.id/otherUserId.",
          },
        },
        { status: 400 }
      );
    }
    if (sitter.userId === ownerId) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[api][messages/conversations] forbidden self chat", { ownerId, sitterUserId: sitter.userId, sitterId: sitter.sitterId });
        console.log("[api][messages/conversations] API END", { status: 403, error: "FORBIDDEN", step: "selfChat" });
      }
      return NextResponse.json({ ok: false, error: "FORBIDDEN", step: "selfChat" }, { status: 403 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[api][messages/conversations] upsert", { ownerId, sitterId: sitter.sitterId, bookingId: bookingId || null });
    }

    const conversation = await prisma.conversation.upsert({
      where: {
        ownerId_sitterId: {
          ownerId,
          sitterId: sitter.sitterId,
        },
      },
      create: {
        ownerId,
        sitterId: sitter.sitterId,
        bookingId: bookingId || null,
        lastMessageAt: null,
        lastMessagePreview: null,
      },
      update: {
        bookingId: bookingId || undefined,
      },
      select: { id: true },
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[api][messages/conversations] API END", { status: 200, ok: true, conversationId: String(conversation.id) });
    }
    return NextResponse.json({ ok: true, conversationId: String(conversation.id) }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][messages][conversations][POST] error", message);
      console.log("[api][messages/conversations] API END", { status: 500, error: "INTERNAL_ERROR" });
    }
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", ...(process.env.NODE_ENV !== "production" ? { message } : null) },
      { status: 500 }
    );
  }
}
