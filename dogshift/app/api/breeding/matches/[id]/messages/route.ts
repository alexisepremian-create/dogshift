import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { matchMessageSchema } from "@/lib/validators/breeding";
import { isMatchParticipant, previewOf } from "@/lib/breeding/matchAuth";

export const runtime = "nodejs";

async function loadMatchForUser(id: string, userId: string) {
  const match = await prisma.match.findUnique({
    where: { id },
    select: {
      id: true,
      closedAt: true,
      dogA: { select: { userId: true } },
      dogB: { select: { userId: true } },
      thread: { select: { id: true } },
    },
  });
  if (!match || match.closedAt || !isMatchParticipant(match, userId)) return null;
  return match;
}

/** GET — messages of a match thread (oldest first), if the caller is in it. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const match = await loadMatchForUser(id, user.id);
    if (!match || !match.thread) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const rows = await prisma.matchMessage.findMany({
      where: { threadId: match.thread.id },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, body: true, senderId: true, createdAt: true },
    });

    // Mark the counterpart's messages as read.
    await prisma.matchMessage.updateMany({
      where: { threadId: match.thread.id, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });

    const messages = rows.map((m) => ({
      id: m.id,
      body: m.body,
      mine: m.senderId === user.id,
      createdAt: m.createdAt,
    }));
    return NextResponse.json({ ok: true, messages });
  } catch (err) {
    console.error("[GET /api/breeding/matches/[id]/messages]", err);
    reportApiError({ kind: "internal_error", route: "breeding.match.messages.get" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** POST { body } — send a message in a match thread. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(matchMessageSchema, await req.json().catch(() => null), {
      route: "breeding.match.messages.post",
    });
    if (!parsed.ok) return parsed.response;

    const match = await loadMatchForUser(id, user.id);
    if (!match || !match.thread) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const body = parsed.data.body.trim();
    const message = await prisma.matchMessage.create({
      data: { threadId: match.thread.id, senderId: user.id, body },
      select: { id: true, body: true, senderId: true, createdAt: true },
    });
    await prisma.matchThread.update({
      where: { id: match.thread.id },
      data: { lastMessageAt: message.createdAt, lastMessagePreview: previewOf(body) },
    });

    return NextResponse.json({
      ok: true,
      message: { id: message.id, body: message.body, mine: true, createdAt: message.createdAt },
    });
  } catch (err) {
    console.error("[POST /api/breeding/matches/[id]/messages]", err);
    reportApiError({ kind: "internal_error", route: "breeding.match.messages.post" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
