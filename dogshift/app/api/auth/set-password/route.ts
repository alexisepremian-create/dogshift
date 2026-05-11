import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { zodParse } from "@/lib/validators/common";
import { setPasswordSchema } from "@/lib/validators/auth";

export const runtime = "nodejs";

/**
 * POST /api/auth/set-password — used by signed-in users who want to set OR
 * rotate their password (e.g. they joined via Google OAuth and now want a
 * fallback password). Replaces Clerk's `clerkClient().users.updateUser({ password })`
 * with a direct bcrypt + Prisma update.
 *
 * Auth.js's session strategy is "database", so previous sessions for the
 * same user remain valid after a password change (only `/api/auth/reset-password`
 * deliberately purges sessions, because that flow assumes a credentials leak).
 */
export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedDbUser();
    if (!authedUser) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const parsed = zodParse(setPasswordSchema, rawBody);
    if (!parsed.ok) return parsed.response;

    const { password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: authedUser.id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auth][set-password] error", { message });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
