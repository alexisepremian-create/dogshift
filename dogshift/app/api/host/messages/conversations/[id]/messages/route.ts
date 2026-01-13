import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/inApp";
import {
  resolveNotificationRecipientForConversation,
  sendNotificationEmail,
} from "@/lib/notifications/sendNotificationEmail";

export const runtime = "nodejs";

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

async function resolveDbUserAndSitterId() {
  const { userId } = await auth();
  if (!userId) return { uid: null as string | null, sitterId: null as string | null };

  const clerkUser = await currentUser();
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!primaryEmail) return { uid: null as string | null, sitterId: null as string | null };

  const dbUser = await prisma.user.findUnique({ where: { email: primaryEmail }, select: { id: true, sitterId: true } });
  if (!dbUser) return { uid: null as string | null, sitterId: null as string | null };

  const sitterProfile = await prisma.sitterProfile.findUnique({ where: { userId: dbUser.id }, select: { sitterId: true } });
  const sitterId =
    (typeof sitterProfile?.sitterId === "string" && sitterProfile.sitterId.trim() ? sitterProfile.sitterId.trim() : null) ??
    (typeof dbUser.sitterId === "string" && dbUser.sitterId.trim() ? dbUser.sitterId.trim() : null);

  return { uid: dbUser.id, sitterId };
}

type Body = { text?: unknown };

function previewOf(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= 140) return trimmed;
  return trimmed.slice(0, 140);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const { uid, sitterId } = await resolveDbUserAndSitterId();
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][send][POST] UNAUTHORIZED", { hasUser: false });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!sitterId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][send][POST] UNAUTHORIZED_NO_SITTER", { uid });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
    const conversationId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!conversationId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][send][POST] INVALID_ID", { idRaw: resolvedParams?.id });
      }
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

    if (conversation.sitterId !== sitterId) {
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
        try {
          const recipientHasSitterProfile = Boolean(
            await prisma.sitterProfile.findUnique({ where: { userId: recipient.recipientUserId }, select: { userId: true } })
          );
          const url = recipientHasSitterProfile
            ? `/host/messages/${encodeURIComponent(conversationId)}`
            : `/account/messages/${encodeURIComponent(conversationId)}`;
          await createNotification({
            userId: recipient.recipientUserId,
            type: "newMessages",
            title: `Nouveau message — ${recipient.fromName}`,
            body: null,
            entityId: conversationId,
            url,
            idempotencyKey: `newMessages:${msg.id}`,
            metadata: { conversationId, senderId: uid, senderName: recipient.fromName },
          });
        } catch (err) {
          console.error("[api][host][messages][send][POST] in-app notification failed", err);
        }

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
      console.error("[api][host][messages][send][POST] notification failed", err);
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
      console.error("[api][host][messages][send][POST] error", err);
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
