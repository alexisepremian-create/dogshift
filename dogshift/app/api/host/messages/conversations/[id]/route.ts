import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RoleJwt = { uid?: string; sub?: string; sitterId?: string };

function tokenUserId(token: RoleJwt | null) {
  const uid = typeof token?.uid === "string" ? token.uid : null;
  const sub = typeof token?.sub === "string" ? token.sub : null;
  return uid ?? sub;
}

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

async function resolveSitterId(uid: string, token: RoleJwt | null) {
  const fromToken = typeof token?.sitterId === "string" && token.sitterId.trim() ? token.sitterId.trim() : null;
  if (fromToken) return fromToken;
  const user = await (prisma as any).user.findUnique({ where: { id: uid }, select: { sitterId: true } });
  const fromDb = typeof user?.sitterId === "string" && user.sitterId.trim() ? user.sitterId.trim() : null;
  return fromDb;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as RoleJwt | null;
    const uid = tokenUserId(token);
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][conversations][id][GET] UNAUTHORIZED", { hasToken: Boolean(token) });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const sitterId = await resolveSitterId(uid, token);
    if (!sitterId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][conversations][id][GET] UNAUTHORIZED_NO_SITTER", { uid });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
    const conversationId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!conversationId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][conversations][id][GET] INVALID_ID", { idRaw: resolvedParams?.id });
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
        owner: { select: { id: true, name: true, image: true } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (conversation.sitterId !== sitterId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    await (prisma as any).message.updateMany({
      where: { conversationId, senderId: { not: uid }, readAt: null },
      data: { readAt: new Date() },
    });

    const messages = await (prisma as any).message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: { id: true, senderId: true, body: true, createdAt: true, readAt: true },
    });

    const ownerName = typeof conversation?.owner?.name === "string" && conversation.owner.name.trim() ? conversation.owner.name.trim() : "Client";
    const avatarUrl = typeof conversation?.owner?.image === "string" && conversation.owner.image.trim() ? conversation.owner.image.trim() : null;

    return NextResponse.json(
      {
        ok: true,
        conversation: {
          id: String(conversation.id),
          owner: { id: String(conversation.ownerId), name: ownerName, avatarUrl },
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
      console.error("[api][host][messages][conversations][id][GET] error", err);
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
