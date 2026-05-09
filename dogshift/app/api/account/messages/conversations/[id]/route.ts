import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = prisma as any;

export const runtime = "nodejs";

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await resolveDbUserId(req);
    if (!ownerId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][conversations][id][GET] UNAUTHORIZED", { reason: "resolveDbUserId returned null" });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = await params;
    const conversationId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!conversationId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][conversations][id][GET] INVALID_ID", { idRaw: resolvedParams?.id });
      }
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        ownerId: true,
        sitterId: true,
        bookingId: true,
        dogProfileId: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        createdAt: true,
        updatedAt: true,
        selectedDog: { select: { id: true, name: true, breed: true, birthYear: true, weightKg: true, medications: true, allergies: true, vetContact: true, behaviorNotes: true, feedingNotes: true, sitterInstructions: true, photoUrl: true } },
        sitter: {
          select: {
            sitterId: true,
            name: true,
            image: true,
            sitterProfile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (conversation.ownerId !== ownerId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    await db.message.updateMany({
      where: { conversationId, senderId: { not: ownerId }, readAt: null },
      data: { readAt: new Date() },
    });

    const messages = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: { id: true, senderId: true, body: true, createdAt: true, readAt: true },
    });

    const sitterName =
      (typeof conversation?.sitter?.sitterProfile?.displayName === "string" && conversation.sitter.sitterProfile.displayName.trim()
        ? conversation.sitter.sitterProfile.displayName.trim()
        : null) ??
      (typeof conversation?.sitter?.name === "string" && conversation.sitter.name.trim() ? conversation.sitter.name.trim() : "Dogsitter");

    const avatarUrl =
      (typeof conversation?.sitter?.sitterProfile?.avatarUrl === "string" && conversation.sitter.sitterProfile.avatarUrl.trim()
        ? conversation.sitter.sitterProfile.avatarUrl.trim()
        : null) ??
      (typeof conversation?.sitter?.image === "string" && conversation.sitter.image.trim() ? conversation.sitter.image.trim() : null);

    return NextResponse.json(
      {
        ok: true,
        viewerId: ownerId,
        conversation: {
          id: String(conversation.id),
          sitter: { sitterId: String(conversation.sitterId), name: sitterName, avatarUrl },
          bookingId: typeof conversation.bookingId === "string" ? conversation.bookingId : null,
          selectedDog: conversation.selectedDog
            ? {
                id: String(conversation.selectedDog.id),
                name: String(conversation.selectedDog.name),
                breed: conversation.selectedDog.breed ?? null,
                birthYear: conversation.selectedDog.birthYear ?? null,
                weightKg: conversation.selectedDog.weightKg ?? null,
                medications: conversation.selectedDog.medications ?? null,
                allergies: conversation.selectedDog.allergies ?? null,
                vetContact: conversation.selectedDog.vetContact ?? null,
                behaviorNotes: conversation.selectedDog.behaviorNotes ?? null,
                feedingNotes: conversation.selectedDog.feedingNotes ?? null,
                sitterInstructions: conversation.selectedDog.sitterInstructions ?? null,
                photoUrl: conversation.selectedDog.photoUrl ?? null,
              }
            : null,
        },
        messages: (messages as any[]).map((m) => ({
          id: String(m.id),
          senderId: String(m.senderId),
          body: String(m.body ?? ""),
          createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt).toISOString(),
          readAt: m.readAt instanceof Date ? m.readAt.toISOString() : m.readAt ? new Date(m.readAt).toISOString() : null,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Database schema missing. Run: prisma migrate dev" },
        { status: 500 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][messages][conversations][id][GET] error", err);
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/** PATCH — owner updates: selected dog, pin, archive, unarchive */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await resolveDbUserId(req);
    if (!ownerId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const { id: conversationId } = await params;
    if (!conversationId) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

    const body = (await req.json()) as {
      dogProfileId?: string | null;
      action?: "pin" | "unpin" | "archive" | "unarchive";
    };

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { ownerId: true },
    });
    if (!conversation) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (conversation.ownerId !== ownerId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    // Handle pin / archive actions
    if (body.action === "pin") {
      await db.conversation.update({ where: { id: conversationId }, data: { pinnedAt: new Date() } });
      return NextResponse.json({ ok: true, action: "pin" });
    }
    if (body.action === "unpin") {
      await db.conversation.update({ where: { id: conversationId }, data: { pinnedAt: null } });
      return NextResponse.json({ ok: true, action: "unpin" });
    }
    if (body.action === "archive") {
      await db.conversation.update({ where: { id: conversationId }, data: { archivedAt: new Date(), pinnedAt: null } });
      return NextResponse.json({ ok: true, action: "archive" });
    }
    if (body.action === "unarchive") {
      await db.conversation.update({ where: { id: conversationId }, data: { archivedAt: null } });
      return NextResponse.json({ ok: true, action: "unarchive" });
    }

    // Default: update selected dog
    const dogProfileId = body.dogProfileId ?? null;
    if (dogProfileId) {
      const dog = await db.dogProfile.findFirst({ where: { id: dogProfileId, userId: ownerId } });
      if (!dog) return NextResponse.json({ ok: false, error: "DOG_NOT_FOUND" }, { status: 404 });
    }

    const updated = await db.conversation.update({
      where: { id: conversationId },
      data: { dogProfileId },
      select: { id: true, dogProfileId: true, selectedDog: { select: { id: true, name: true, breed: true } } },
    });

    return NextResponse.json({ ok: true, selectedDog: updated.selectedDog ?? null });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][messages][conversations][id][PATCH] error", err);
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/** DELETE — owner soft-deletes a conversation (sets deletedAt) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ownerId = await resolveDbUserId(req);
    if (!ownerId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const { id: conversationId } = await params;
    if (!conversationId) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { ownerId: true },
    });
    if (!conversation) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (conversation.ownerId !== ownerId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    await db.conversation.update({ where: { id: conversationId }, data: { deletedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][messages][conversations][id][DELETE] error", err);
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
