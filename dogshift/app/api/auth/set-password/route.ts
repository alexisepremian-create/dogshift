import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const uid = (token as unknown as { uid?: string }).uid;

    if (!uid) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as unknown;
    const passwordRaw = (body as { password?: unknown }).password;
    const password = typeof passwordRaw === "string" ? passwordRaw : "";

    if (!password || password.length < 8) {
      return NextResponse.json({ ok: false, error: "PASSWORD_TOO_SHORT" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const existingHash = (user as unknown as { passwordHash?: string | null }).passwordHash;
    if (existingHash) {
      return NextResponse.json({ ok: false, error: "PASSWORD_ALREADY_SET" }, { status: 409 });
    }

    const bcryptjs = await import("bcryptjs");
    const passwordHash = await bcryptjs.hash(password, 10);

    await prisma.user.update({
      where: { id: uid },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[auth][set-password] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
