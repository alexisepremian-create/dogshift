import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RoleJwt = { uid?: string; sub?: string; sitterId?: string };

type Body = { ownerId?: unknown; bookingId?: unknown };

function tokenUserId(token: RoleJwt | null) {
  const uid = typeof token?.uid === "string" ? token.uid : null;
  const sub = typeof token?.sub === "string" ? token.sub : null;
  return uid ?? sub;
}

async function resolveSitterId(uid: string, token: RoleJwt | null) {
  const fromToken = typeof token?.sitterId === "string" && token.sitterId.trim() ? token.sitterId.trim() : null;
  if (fromToken) return fromToken;
  const user = await (prisma as any).user.findUnique({ where: { id: uid }, select: { sitterId: true } });
  const fromDb = typeof user?.sitterId === "string" && user.sitterId.trim() ? user.sitterId.trim() : null;
  return fromDb;
}

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

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXTAUTH_SECRET) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][start][POST] NEXTAUTH_SECRET_MISSING");
      }
      return NextResponse.json({ ok: false, error: "CONFIG_ERROR", message: "NEXTAUTH_SECRET is missing" }, { status: 500 });
    }

    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as RoleJwt | null;
    const uid = tokenUserId(token);
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][start][POST] UNAUTHORIZED", { hasToken: Boolean(token) });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const sitterId = await resolveSitterId(uid, token);
    if (!sitterId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][start][POST] UNAUTHORIZED_NO_SITTER", { uid });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const ownerId = typeof body?.ownerId === "string" ? body.ownerId.trim() : "";
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId.trim() : "";

    if (!ownerId) {
      return NextResponse.json({ ok: false, error: "INVALID_OWNER_ID" }, { status: 400 });
    }

    const owner = await (prisma as any).user.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!owner) {
      return NextResponse.json({ ok: false, error: "INVALID_OWNER" }, { status: 404 });
    }

    const conversationDelegate = (prisma as any)?.conversation;
    if (!conversationDelegate || typeof conversationDelegate.upsert !== "function") {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][start][POST] PRISMA_CLIENT_OUTDATED", { hasConversationModel: Boolean(conversationDelegate) });
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
          sitterId,
        },
      },
      create: {
        ownerId,
        sitterId,
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
        console.error("[api][host][messages][start][POST] FK_ERROR", err);
      }
      return NextResponse.json({ ok: false, error: "INVALID_OWNER" }, { status: 404 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][host][messages][start][POST] error", err);
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", ...(process.env.NODE_ENV !== "production" ? { message } : null) },
      { status: 500 }
    );
  }
}
