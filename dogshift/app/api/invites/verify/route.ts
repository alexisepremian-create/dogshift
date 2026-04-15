import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { zodParse } from "@/lib/validators/common";
import { inviteVerifySchema } from "@/lib/validators/contact";

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
    const ip = getClientIp(req);
    const rl = checkRateLimit(`invite:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const parsedBody = zodParse(inviteVerifySchema, rawBody);
    if (!parsedBody.ok) return parsedBody.response;

    const code = normalizeCode(parsedBody.data.code);

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
    const secure = process.env.NODE_ENV === "production";
    res.cookies.set({
      name: "ds_invite_unlocked",
      value: "1",
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: sevenDaysSeconds,
      path: "/",
    });

    res.cookies.set({
      name: "ds_invite",
      value: "1",
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: sevenDaysSeconds,
      path: "/",
    });

    res.cookies.set({
      name: "dogsitter_invite_id",
      value: invite.id,
      httpOnly: true,
      secure,
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
