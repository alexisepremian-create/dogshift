import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

function isPrismaInconsistentResultError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes("inconsistent query result") || msg.includes("P2025");
}

type ConversationListItem = {
  id: string;
  bookingId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  updatedAt: string;
  sitter: { sitterId: string; name: string; avatarUrl: string | null };
  booking: { service: string | null; startDate: string | null; endDate: string | null } | null;
  unreadCount: number;
};

export async function GET(req: NextRequest) {
  let ownerIdForLog: string | null = null;
  try {
    const ownerId = await resolveDbUserId(req);
    if (!ownerId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][conversations][GET] UNAUTHORIZED", { reason: "resolveDbUserId returned null" });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    ownerIdForLog = ownerId;

    const conversations = await (prisma as any).conversation.findMany({
      where: { ownerId },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        bookingId: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        updatedAt: true,
        sitterId: true,
        booking: {
          select: { service: true, startDate: true, endDate: true },
        },
      },
    });

    if (!Array.isArray(conversations) || conversations.length === 0) {
      return NextResponse.json({ ok: true, conversations: [] }, { status: 200 });
    }

    const sitterKeys = Array.from(
      new Set(
        conversations
          .map((c: any) => (typeof c?.sitterId === "string" ? c.sitterId : ""))
          .map((s: string) => s.trim())
          .filter(Boolean)
      )
    );

    const sitters = await (prisma as any).user.findMany({
      where: {
        OR: [{ sitterId: { in: sitterKeys } }, { id: { in: sitterKeys } }],
      },
      select: {
        id: true,
        sitterId: true,
        name: true,
        image: true,
        sitterProfile: { select: { displayName: true, avatarUrl: true } },
      },
    });

    const sitterByKey = new Map<string, any>();
    for (const u of Array.isArray(sitters) ? sitters : []) {
      if (typeof u?.sitterId === "string" && u.sitterId.trim()) sitterByKey.set(u.sitterId.trim(), u);
      if (typeof u?.id === "string" && u.id.trim()) sitterByKey.set(u.id.trim(), u);
    }

    const unreadCounts = await Promise.all(
      conversations.map(async (c: any) => {
        try {
          const cnt = await (prisma as any).message.count({
            where: {
              conversationId: c.id,
              senderId: { not: ownerId },
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
      const sitterKey = typeof c?.sitterId === "string" ? c.sitterId : "";
      const sitter = sitterByKey.get(sitterKey) ?? null;

      const displayName =
        (typeof sitter?.sitterProfile?.displayName === "string" && sitter.sitterProfile.displayName.trim()
          ? sitter.sitterProfile.displayName.trim()
          : null) ??
        (typeof sitter?.name === "string" && sitter.name.trim() ? sitter.name.trim() : "Dogsitter");

      const avatarUrlRaw =
        (typeof sitter?.sitterProfile?.avatarUrl === "string" && sitter.sitterProfile.avatarUrl.trim()
          ? sitter.sitterProfile.avatarUrl.trim()
          : null) ??
        (typeof sitter?.image === "string" && sitter.image.trim() ? sitter.image.trim() : null);

      return {
        id: String(c.id),
        bookingId: typeof c.bookingId === "string" ? c.bookingId : null,
        lastMessageAt: c.lastMessageAt instanceof Date ? c.lastMessageAt.toISOString() : c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : null,
        lastMessagePreview: typeof c.lastMessagePreview === "string" ? c.lastMessagePreview : null,
        updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : new Date(c.updatedAt).toISOString(),
        sitter: {
          sitterId: String((typeof sitter?.sitterId === "string" && sitter.sitterId) || sitterKey),
          name: displayName,
          avatarUrl: avatarUrlRaw,
        },
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
    if (isPrismaInconsistentResultError(err)) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][conversations][GET] INCONSISTENT_RESULT", { err });
      }
      return NextResponse.json({ ok: true, conversations: [] }, { status: 200 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][messages][conversations][GET] error", { ownerId: ownerIdForLog, err });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
