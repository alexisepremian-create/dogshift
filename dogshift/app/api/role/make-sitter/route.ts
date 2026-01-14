import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";

type EmailToken = JWT & { email?: string };

export async function POST(req: Request) {
  const expected = (process.env.DOGSHIFT_ADMIN_SECRET || "").trim();
  const provided = (req.headers.get("x-dogshift-admin-secret") || "").trim();
  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const token = (await getToken({ req: req as never, secret: process.env.NEXTAUTH_SECRET })) as EmailToken | null;
  const email = token?.email;
  if (!email) return NextResponse.json({ ok: false }, { status: 401 });

  const existing = await prisma.user.findUnique({ where: { email } });
  const existingSitterId = (existing as unknown as { sitterId?: string } | null)?.sitterId;
  const sitterId = (typeof existingSitterId === "string" && existingSitterId.trim())
    ? existingSitterId.trim()
    : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const user = await prisma.user.update({
    where: { email },
    data: { role: "SITTER", sitterId } as unknown as { role: "SITTER"; sitterId: string },
  });

  const db = prisma as unknown as { sitterProfile: any };
  await db.sitterProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      sitterId,
      published: false,
      publishedAt: null,
    },
    update: {
      sitterId,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, sitterId });
}
