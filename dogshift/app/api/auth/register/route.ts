import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const name = typeof (body as { name?: unknown }).name === "string" ? (body as { name?: string }).name?.trim() : undefined;
    const emailRaw = (body as { email?: unknown }).email;
    const passwordRaw = (body as { password?: unknown }).password;

    const email = typeof emailRaw === "string" ? emailRaw.replace(/\s+/g, "+").trim().toLowerCase() : "";
    const password = typeof passwordRaw === "string" ? passwordRaw : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ ok: false, error: "PASSWORD_TOO_SHORT" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });

    const bcryptjs = await import("bcryptjs");
    const passwordHash = await bcryptjs.hash(password, 10);

    if (existing) {
      const existingHash = (existing as unknown as { passwordHash?: string | null }).passwordHash;

      if (existingHash) {
        return NextResponse.json({ ok: false, error: "EMAIL_ALREADY_REGISTERED" }, { status: 409 });
      }

      await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          ...(name ? { name } : {}),
        },
      });

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await prisma.user.create({
      data: {
        email,
        ...(name ? { name } : {}),
        passwordHash,
        role: "OWNER",
      } as unknown as { email: string; name?: string; passwordHash: string; role: "OWNER" },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[auth][register] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
