import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { adoptionMessageSchema } from "@/lib/validators/adoption";
import { loadApplicationAccess } from "@/lib/adoption/access";

export const runtime = "nodejs";

const PAGE_SIZE = 100;

/**
 * Cédant ↔ adopter chat, scoped to one application.
 *
 * Deliberately not the existing `Conversation` model: that one is keyed on
 * (ownerId, sitterId) and would collide the moment a sitter also adopts.
 */

/** GET — the thread's messages, oldest first. Marks the other side's messages read. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const access = await loadApplicationAccess(id, user.id);
    if (!access) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const thread = access.application.thread;
    if (!thread) return NextResponse.json({ ok: true, threadId: null, messages: [] });

    const messages = await prisma.adoptionMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
      take: PAGE_SIZE,
      select: { id: true, senderId: true, body: true, readAt: true, createdAt: true },
    });

    await prisma.adoptionMessage.updateMany({
      where: { threadId: thread.id, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      threadId: thread.id,
      messages: messages.map((m) => ({ ...m, mine: m.senderId === user.id })),
    });
  } catch (err) {
    console.error("[GET /api/adoption/applications/[id]/messages]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.messages.list" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * POST — send a message.
 *
 * A declined or withdrawn application closes the thread: reopening it is how
 * rejected candidates end up harassing cédants, which is the failure mode every
 * rehoming platform eventually has to design against.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(adoptionMessageSchema, await req.json().catch(() => null), {
      route: "adoption.messages.send",
    });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data.body.trim();

    const access = await loadApplicationAccess(id, user.id);
    if (!access) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (access.application.status === "DECLINED" || access.application.status === "WITHDRAWN") {
      return NextResponse.json({ ok: false, error: "THREAD_CLOSED" }, { status: 409 });
    }

    const now = new Date();
    const thread = await prisma.adoptionThread.upsert({
      where: { applicationId: id },
      create: { applicationId: id, lastMessageAt: now, lastMessagePreview: body.slice(0, 140) },
      update: { lastMessageAt: now, lastMessagePreview: body.slice(0, 140) },
      select: { id: true },
    });

    const message = await prisma.adoptionMessage.create({
      data: { threadId: thread.id, senderId: user.id, body },
      select: { id: true, senderId: true, body: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, threadId: thread.id, message }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/adoption/applications/[id]/messages]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.messages.send" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
