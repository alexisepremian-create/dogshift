/**
 * POST /api/auth/reset-password
 *
 * Body: { email: string, token: string, password: string }
 *
 * Validates the token (hash + expiry + identifier match), bcrypt-hashes the
 * new password (cost 12), updates the User, marks email as verified, and
 * deletes the token (single-use). All Session rows for this user are also
 * invalidated so existing devices must re-login with the new password.
 *
 * Returns 400 INVALID_TOKEN for any token failure (expired, mismatched, used).
 * Returns 400 WEAK_PASSWORD if the new password fails the strength rules.
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  hashResetToken,
  resetTokenIdentifier,
} from "@/lib/auth/passwordResetToken";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().email().max(254),
  token: z.string().min(32).max(128),
  // 8+ chars, at least one uppercase, at least one digit.
  password: z
    .string()
    .min(8, "PASSWORD_TOO_SHORT")
    .max(200, "PASSWORD_TOO_LONG")
    .regex(/[A-Z]/, "PASSWORD_MISSING_UPPERCASE")
    .regex(/[0-9]/, "PASSWORD_MISSING_DIGIT"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const code =
      firstIssue?.message && firstIssue.message.startsWith("PASSWORD_")
        ? "WEAK_PASSWORD"
        : "INVALID_BODY";
    reportApiError({
      kind: "validation_error",
      code,
      route: "auth.reset-password",
      extra: { issues: parsed.error.issues.map((i) => i.message) },
    });
    return NextResponse.json({ ok: false, error: code }, { status: 400 });
  }

  const { email: rawEmail, token, password } = parsed.data;
  const email = rawEmail.trim().toLowerCase();
  const identifier = resetTokenIdentifier(email);
  const hash = hashResetToken(token);

  try {
    const stored = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier, token: hash } },
    });

    if (!stored || stored.expires.getTime() < Date.now()) {
      // Best-effort cleanup if we found an expired one.
      if (stored) {
        await prisma.verificationToken.delete({
          where: { identifier_token: { identifier, token: hash } },
        }).catch(() => undefined);
      }
      reportApiError({
        kind: "validation_error",
        code: "INVALID_TOKEN",
        route: "auth.reset-password",
      });
      return NextResponse.json(
        { ok: false, error: "INVALID_TOKEN" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Token existed for a no-longer-present user — clean up and bail.
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token: hash } },
      }).catch(() => undefined);
      reportApiError({
        kind: "validation_error",
        code: "INVALID_TOKEN",
        route: "auth.reset-password",
      });
      return NextResponse.json(
        { ok: false, error: "INVALID_TOKEN" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          emailVerified: user.emailVerified ?? new Date(),
        },
      }),
      // Single-use token.
      prisma.verificationToken.delete({
        where: { identifier_token: { identifier, token: hash } },
      }),
      // Invalidate every existing session for this user.
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "RESET_PASSWORD_FAILED",
      route: "auth.reset-password",
      extra: { message: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
