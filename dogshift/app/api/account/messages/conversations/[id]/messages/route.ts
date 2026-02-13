import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { createNotification } from "@/lib/notifications/inApp";
import {
  resolveNotificationRecipientForConversation,
  sendNotificationEmail,
} from "@/lib/notifications/sendNotificationEmail";
import { hasNotificationAlreadySent, shouldSendUserNotification } from "@/lib/notifications/prefs";

export const runtime = "nodejs";

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

function throttleBucket10Min() {
  return Math.floor(Date.now() / (10 * 60 * 1000));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("[api][account][messages][send][POST] entered");
    }
    const uid = await resolveDbUserId(req);
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][send][POST] UNAUTHORIZED", { reason: "resolveDbUserId returned null" });
        console.log("[api][account][messages][send][POST] API END", { status: 401, error: "UNAUTHORIZED" });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
    const conversationId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!conversationId) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[api][account][messages][send][POST] API END", { status: 400, error: "INVALID_ID" });
      }
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const body = (await req.json()) as Body;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[api][account][messages][send][POST] API END", { status: 400, error: "INVALID_TEXT" });
      }
      return NextResponse.json({ ok: false, error: "INVALID_TEXT" }, { status: 400 });
    }

    const conversation = await (prisma as any).conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, ownerId: true, sitterId: true },
    });

    if (!conversation) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[api][account][messages][send][POST] API END", { status: 404, error: "NOT_FOUND" });
      }
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (conversation.ownerId !== uid) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[api][account][messages][send][POST] API END", { status: 403, error: "FORBIDDEN" });
      }
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

    // Respond ASAP; run notifications in background to avoid hanging the request.
    const response = NextResponse.json(
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

    if (process.env.NODE_ENV !== "production") {
      console.log("[api][account][messages][send][POST] API END", { status: 200, ok: true, messageId: String(msg.id) });
    }

    void (async () => {
      try {
        const recipient = await resolveNotificationRecipientForConversation({
          conversationId,
          senderUserId: uid,
        });
        if (!recipient) return;

        try {
          const recipientHasSitterProfile = Boolean(
            await prisma.sitterProfile.findUnique({ where: { userId: recipient.recipientUserId }, select: { userId: true } })
          );
          const url = recipientHasSitterProfile
            ? `/host/messages/${encodeURIComponent(conversationId)}`
            : `/account/messages/${encodeURIComponent(conversationId)}`;

          const sender = await prisma.user.findUnique({
            where: { id: uid },
            select: { name: true, sitterProfile: { select: { displayName: true } } },
          });
          const senderNameRaw =
            (typeof sender?.sitterProfile?.displayName === "string" && sender.sitterProfile.displayName.trim()
              ? sender.sitterProfile.displayName.trim()
              : null) ??
            (typeof sender?.name === "string" && sender.name.trim() ? sender.name.trim() : null);
          const senderName = senderNameRaw ?? "Utilisateur";

          await createNotification({
            userId: recipient.recipientUserId,
            type: "newMessages",
            title: `Nouveau message — ${senderName}`,
            body: null,
            entityId: conversationId,
            url,
            idempotencyKey: `newMessages:${msg.id}`,
            metadata: { conversationId, senderUserId: uid, senderName },
          });
        } catch (err) {
          console.error("[api][account][messages][send][POST] in-app notification failed", err);
        }

        try {
          const throttleBucket = throttleBucket10Min();
          const entityId = `${conversationId}:${throttleBucket}`;
          const pref = await shouldSendUserNotification(recipient.recipientUserId, "messageReceived");
          const already = await hasNotificationAlreadySent(recipient.recipientUserId, "messageReceived", entityId);

          if (!pref) {
            console.log(
              `MESSAGE_EMAIL_SKIP: recipientUserId=${recipient.recipientUserId} conversationId=${conversationId} pref=false throttleBucket=${throttleBucket} entityId=${entityId} reason=PREF_OFF`
            );
            return;
          }

          if (already) {
            console.log(
              `MESSAGE_EMAIL_SKIP: recipientUserId=${recipient.recipientUserId} conversationId=${conversationId} pref=true throttleBucket=${throttleBucket} entityId=${entityId} reason=THROTTLED_OR_ALREADY_SENT`
            );
            return;
          }

          console.log(
            `MESSAGE_EMAIL_TRIGGER: recipientUserId=${recipient.recipientUserId} conversationId=${conversationId} pref=true throttleBucket=${throttleBucket} entityId=${entityId}`
          );

          await sendNotificationEmail({
            recipientUserId: recipient.recipientUserId,
            key: "messageReceived",
            entityId,
            req,
            payload: {
              kind: "newMessage",
              conversationId,
              messagePreview: previewOf(text),
              fromName: recipient.fromName,
            },
          });
        } catch (err) {
          console.error("[api][account][messages][send][POST] email notification failed", err);
        }
      } catch (err) {
        console.error("[api][account][messages][send][POST] notification failed", err);
      }
    })();

    return response;
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Database schema missing. Run: prisma migrate dev" },
        { status: 500 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][messages][send][POST] error", err);
      console.log("[api][account][messages][send][POST] API END", { status: 500, error: "INTERNAL_ERROR" });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
