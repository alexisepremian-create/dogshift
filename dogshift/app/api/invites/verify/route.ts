import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function normalizeCode(input: string) {
  return input.replace(/\s+/g, "").trim().toUpperCase();
}

function maskCode(code: string) {
  if (!code) return "***";
  if (code.length <= 6) return "***";
  return `${code.slice(0, 3)}***${code.slice(-3)}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { code?: unknown };
    const raw = typeof body?.code === "string" ? body.code : "";
    const code = normalizeCode(raw);

    if (!code) {
      return NextResponse.json({ ok: false, error: "CODE_REQUIRED" }, { status: 400 });
    }

    const now = new Date();

    const invite = await prisma.inviteCode.findUnique({
      where: { code },
      select: { id: true, type: true, usedAt: true, expiresAt: true },
    });

    if (!invite) {
      console.info("[invites][verify] invalid", { codeMasked: maskCode(code) });
      return NextResponse.json({ ok: false, error: "CODE_INVALID" }, { status: 404 });
    }

    if (invite.expiresAt && invite.expiresAt instanceof Date && invite.expiresAt.getTime() <= now.getTime()) {
      console.info("[invites][verify] expired", { codeMasked: maskCode(code) });
      return NextResponse.json({ ok: false, error: "CODE_EXPIRED" }, { status: 410 });
    }

    if (invite.type === "single_use" && invite.usedAt) {
      console.info("[invites][verify] already used", { codeMasked: maskCode(code) });
      return NextResponse.json({ ok: false, error: "CODE_ALREADY_USED" }, { status: 409 });
    }

    const res = NextResponse.json({ ok: true, inviteId: invite.id }, { status: 200 });

    const sevenDaysSeconds = 7 * 24 * 60 * 60;
    res.cookies.set({
      name: "dogsitter_invite",
      value: "ok",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sevenDaysSeconds,
      path: "/",
    });

    res.cookies.set({
      name: "dogsitter_invite_id",
      value: invite.id,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sevenDaysSeconds,
      path: "/",
    });

    return res;
  } catch (err) {
    console.error("[invites][verify] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
