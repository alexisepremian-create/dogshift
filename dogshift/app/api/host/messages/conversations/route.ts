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

type ConversationListItem = {
  id: string;
  bookingId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  updatedAt: string;
  owner: { id: string; name: string; avatarUrl: string | null };
  booking: { service: string | null; startDate: string | null; endDate: string | null } | null;
  unreadCount: number;
};

export async function GET(req: NextRequest) {
  try {
    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as RoleJwt | null;
    const uid = tokenUserId(token);
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][conversations][GET] UNAUTHORIZED", { hasToken: Boolean(token) });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const sitterId = await resolveSitterId(uid, token);
    if (!sitterId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][conversations][GET] UNAUTHORIZED_NO_SITTER", { uid });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const conversations = await (prisma as any).conversation.findMany({
      where: { sitterId },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        ownerId: true,
        sitterId: true,
        bookingId: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, image: true } },
        booking: { select: { service: true, startDate: true, endDate: true } },
      },
    });

    const unreadCounts = await Promise.all(
      conversations.map(async (c: any) => {
        try {
          const cnt = await (prisma as any).message.count({
            where: {
              conversationId: c.id,
              senderId: { not: uid },
              readAt: null,
            },
          });
          return typeof cnt === "number" ? cnt : 0;
        } catch {
          return 0;
        }
      })
    );

    const items: ConversationListItem[] = conversations.map((c: any, idx: number) => {
      const ownerName = typeof c?.owner?.name === "string" && c.owner.name.trim() ? c.owner.name.trim() : "Client";
      const avatarUrlRaw = typeof c?.owner?.image === "string" && c.owner.image.trim() ? c.owner.image.trim() : null;

      return {
        id: String(c.id),
        bookingId: typeof c.bookingId === "string" ? c.bookingId : null,
        lastMessageAt: c.lastMessageAt instanceof Date ? c.lastMessageAt.toISOString() : c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : null,
        lastMessagePreview: typeof c.lastMessagePreview === "string" ? c.lastMessagePreview : null,
        updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : new Date(c.updatedAt).toISOString(),
        owner: { id: String(c.ownerId), name: ownerName, avatarUrl: avatarUrlRaw },
        booking: c.booking
          ? {
              service: typeof c.booking.service === "string" ? c.booking.service : null,
              startDate: c.booking.startDate instanceof Date ? c.booking.startDate.toISOString() : c.booking.startDate ? new Date(c.booking.startDate).toISOString() : null,
              endDate: c.booking.endDate instanceof Date ? c.booking.endDate.toISOString() : c.booking.endDate ? new Date(c.booking.endDate).toISOString() : null,
            }
          : null,
        unreadCount: unreadCounts[idx] ?? 0,
      };
    });

    return NextResponse.json({ ok: true, conversations: items }, { status: 200 });
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Database schema missing. Run: prisma migrate dev" },
        { status: 500 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][host][messages][conversations][GET] error", err);
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
