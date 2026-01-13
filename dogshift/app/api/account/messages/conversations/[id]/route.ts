import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

export async function GET(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const ownerId = await resolveDbUserId(req);
    if (!ownerId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][conversations][id][GET] UNAUTHORIZED", { reason: "resolveDbUserId returned null" });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
    const conversationId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!conversationId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][conversations][id][GET] INVALID_ID", { idRaw: resolvedParams?.id });
      }
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const conversation = await (prisma as any).conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        ownerId: true,
        sitterId: true,
        bookingId: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        createdAt: true,
        updatedAt: true,
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

    await (prisma as any).message.updateMany({
      where: { conversationId, senderId: { not: ownerId }, readAt: null },
      data: { readAt: new Date() },
    });

    const messages = await (prisma as any).message.findMany({
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
        conversation: {
          id: String(conversation.id),
          sitter: { sitterId: String(conversation.sitterId), name: sitterName, avatarUrl },
          bookingId: typeof conversation.bookingId === "string" ? conversation.bookingId : null,
        },
        messages: messages.map((m: any) => ({
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
