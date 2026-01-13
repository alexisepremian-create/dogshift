import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

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

export async function GET(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const { uid, sitterId } = await resolveDbUserAndSitterId();
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][conversations][id][GET] UNAUTHORIZED", { hasUser: false });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

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
        viewerId: uid,
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
