import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

type Body = {
  otherUserId?: unknown;
  sitterId?: unknown;
  bookingId?: unknown;
};

async function resolveSitterKey(input: string) {
  const raw = input.trim();
  if (!raw) return null;

  let user: { id: string; sitterId: string | null } | null = null;

  // Accept either User.id or User.sitterId
  user = await prisma.user.findUnique({ where: { id: raw }, select: { id: true, sitterId: true } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { sitterId: raw }, select: { id: true, sitterId: true } });
  }

  const sitterId = typeof user?.sitterId === "string" && user.sitterId.trim() ? user.sitterId.trim() : null;
  const userId = typeof user?.id === "string" && user.id.trim() ? user.id.trim() : null;
  if (!userId || !sitterId) return null;
  return { userId, sitterId };
}

export async function POST(req: NextRequest) {
  try {
    const ownerId = await resolveDbUserId(req);
    if (!ownerId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!owner) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 401 });

    const body = (await req.json()) as Body;
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId.trim() : "";

    const otherUserId = typeof body?.otherUserId === "string" ? body.otherUserId.trim() : "";
    const sitterIdInput = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";

    const sitter = await (async () => {
      if (otherUserId) return resolveSitterKey(otherUserId);
      if (sitterIdInput) return resolveSitterKey(sitterIdInput);
      return null;
    })();

    if (!sitter) return NextResponse.json({ ok: false, error: "INVALID_SITTER" }, { status: 400 });
    if (sitter.userId === ownerId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const conversation = await prisma.conversation.upsert({
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
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][messages][conversations][POST] error", message);
    }
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", ...(process.env.NODE_ENV !== "production" ? { message } : null) },
      { status: 500 }
    );
  }
}
