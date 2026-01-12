import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";
import {
  resolveNotificationRecipientForConversation,
  sendNotificationEmail,
} from "@/lib/notifications/sendNotificationEmail";

export const runtime = "nodejs";

type RoleJwt = { uid?: string; sub?: string };

function tokenUserId(token: RoleJwt | null) {
  const uid = typeof token?.uid === "string" ? token.uid : null;
  const sub = typeof token?.sub === "string" ? token.sub : null;
  return uid ?? sub;
}

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

type Body = { text?: unknown };

function previewOf(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= 140) return trimmed;
  return trimmed.slice(0, 140);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as RoleJwt | null;
    const uid = tokenUserId(token);
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][send][POST] UNAUTHORIZED", { hasToken: Boolean(token) });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
    const conversationId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!conversationId) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const body = (await req.json()) as Body;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ ok: false, error: "INVALID_TEXT" }, { status: 400 });
    }

    const conversation = await (prisma as any).conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, ownerId: true, sitterId: true },
    });

    if (!conversation) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (conversation.ownerId !== uid) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const msg = await (prisma as any).message.create({
      data: { conversationId, senderId: uid, body: text },
      select: { id: true, createdAt: true },
    });

    const now = new Date();
    await (prisma as any).conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        lastMessagePreview: previewOf(text),
      },
      select: { id: true },
    });

    try {
      const recipient = await resolveNotificationRecipientForConversation({
        conversationId,
        senderUserId: uid,
      });
      if (recipient) {
        await sendNotificationEmail({
          recipientUserId: recipient.recipientUserId,
          key: "newMessages",
          entityId: String(msg.id),
          payload: {
            kind: "newMessage",
            conversationId,
            messagePreview: previewOf(text),
            fromName: recipient.fromName,
          },
        });
      }
    } catch (err) {
      console.error("[api][account][messages][send][POST] notification failed", err);
    }

    return NextResponse.json(
      {
        ok: true,
        message: {
          id: String(msg.id),
          senderId: uid,
          body: text,
          createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : new Date(msg.createdAt).toISOString(),
        },
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
      console.error("[api][account][messages][send][POST] error", err);
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
