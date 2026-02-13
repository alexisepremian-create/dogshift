import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

function isMigrationMissingError(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P2021";
  }
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist");
}

function isPrismaForeignKeyError(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P2003";
  }
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes("foreign key");
}

async function resolveSitterKey(input: string) {
  const raw = input.trim();
  if (!raw) return null;

  // Conversation.sitterId references User.sitterId (public id), not User.id.
  // Accept either and resolve to { userId, sitterId }.
  let user: any = null;

  if (raw.startsWith("s-")) {
    user = await (prisma as any).user.findUnique({ where: { sitterId: raw }, select: { id: true, sitterId: true } });
  } else {
    user = await (prisma as any).user.findUnique({ where: { id: raw }, select: { id: true, sitterId: true } });
    if (!user) {
      user = await (prisma as any).user.findUnique({ where: { sitterId: raw }, select: { id: true, sitterId: true } });
    }
  }

  const sitterId = typeof user?.sitterId === "string" && user.sitterId.trim() ? user.sitterId.trim() : null;
  const userId = typeof user?.id === "string" && user.id.trim() ? user.id.trim() : null;
  if (!userId || !sitterId) return null;
  return { userId, sitterId };
}

type Body = { sitterId?: unknown; bookingId?: unknown };

export async function POST(req: NextRequest) {
  try {
    const ownerId = await resolveDbUserId(req);
    if (!ownerId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][start][POST] UNAUTHORIZED");
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!owner) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][start][POST] OWNER_NOT_FOUND", { uid: ownerId });
      }
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const sitterInput = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId.trim() : "";

    if (!sitterInput) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][start][POST] INVALID_SITTER_ID", { uid: ownerId, sitterIdRaw: body?.sitterId });
      }
      return NextResponse.json({ ok: false, error: "INVALID_SITTER_ID" }, { status: 400 });
    }

    const sitter = await resolveSitterKey(sitterInput);
    if (!sitter) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][start][POST] INVALID_SITTER", { uid: ownerId, sitterIdRaw: sitterInput });
      }
      return NextResponse.json({ ok: false, error: "INVALID_SITTER" }, { status: 404 });
    }

    if (sitter.userId === ownerId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][start][POST] FORBIDDEN_SELF", { uid: ownerId, sitterIdRaw: sitterInput });
      }
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const conversationDelegate = (prisma as any)?.conversation;
    if (!conversationDelegate || typeof conversationDelegate.upsert !== "function") {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][start][POST] PRISMA_CLIENT_OUTDATED", {
          hasConversationModel: Boolean(conversationDelegate),
        });
      }
      return NextResponse.json(
        {
          ok: false,
          error: "PRISMA_CLIENT_OUTDATED",
          message: "Prisma Client is missing the Conversation model. Run: npx prisma generate (and ensure migrations are applied).",
        },
        { status: 500 }
      );
    }

    const conversation = await conversationDelegate.upsert({
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

    return NextResponse.json({ ok: true, conversationId: String(conversation.id) }, { status: 200 });
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Database schema missing. Run: prisma migrate dev" },
        { status: 500 }
      );
    }
    if (isPrismaForeignKeyError(err)) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][messages][start][POST] FK_ERROR", err);
      }
      return NextResponse.json({ ok: false, error: "INVALID_SITTER" }, { status: 404 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][messages][start][POST] error", err);
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", ...(process.env.NODE_ENV !== "production" ? { message } : null) },
      { status: 500 }
    );
  }
}
