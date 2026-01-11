import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Body = { ownerId?: unknown; bookingId?: unknown };

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
    const { uid, sitterId } = await resolveDbUserAndSitterId();
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][messages][start][POST] UNAUTHORIZED", { hasUser: false });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

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
