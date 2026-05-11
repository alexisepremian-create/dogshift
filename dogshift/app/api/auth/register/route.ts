/**
 * POST /api/auth/register — Credentials signup.
 *
 * Creates a User row with a bcrypt-hashed password and triggers an email
 * verification link. The actual sign-in step is performed client-side by the
 * SignUpForm (calls `signIn("credentials", ...)` right after this returns OK).
 *
 * Validation rules:
 *  - email: trimmed, lowercased, RFC-ish format, ≤ 254 chars
 *  - password: 8+ chars, ≥ 1 uppercase, ≥ 1 digit
 *  - intent: "owner" | "sitter" (the SitterProfile is created by the admin
 *    later — at signup we just remember the intent for analytics + the
 *    /post-login routing)
 *
 * Conflict handling:
 *  - If a User already exists with that email and has a passwordHash → 409
 *    EMAIL_ALREADY_REGISTERED (we don't reveal more — they should go log in).
 *  - If a User exists but has NO passwordHash (Clerk-imported / Google-only),
 *    we set the new passwordHash so they regain access. This is the natural
 *    "I forgot I had an account" recovery for migrated users.
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailVerificationEmail } from "@/lib/email/templates/emailVerificationEmail";
import { generateResetToken } from "@/lib/auth/passwordResetToken";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().email().max(254),
  password: z
    .string()
    .min(8, "PASSWORD_TOO_SHORT")
    .max(200, "PASSWORD_TOO_LONG")
    .regex(/[A-Z]/, "PASSWORD_MISSING_UPPERCASE")
    .regex(/[0-9]/, "PASSWORD_MISSING_DIGIT"),
  name: z.string().trim().min(1).max(80).nullable().optional(),
  intent: z.enum(["owner", "sitter"]).optional(),
});

function emailVerificationIdentifier(email: string): string {
  return `email-verification:${email.trim().toLowerCase()}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
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
      route: "auth.register",
    });
    return NextResponse.json({ ok: false, error: code }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name ?? null;
  // We currently store role as OWNER always; sitter intent is tracked
  // separately via the SitterApplication flow. Storing the intent on the
  // User row would conflict with the existing role-promotion logic.
  void parsed.data.intent;

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, name: true },
    });

    let userId: string;

    if (existing?.id) {
      if (existing.passwordHash) {
        reportApiError({
          kind: "conflict",
          code: "EMAIL_ALREADY_REGISTERED",
          route: "auth.register",
        });
        return NextResponse.json(
          { ok: false, error: "EMAIL_ALREADY_REGISTERED" },
          { status: 409 },
        );
      }
      // Account exists with no password yet (Clerk-imported or Google-only) —
      // claim it by setting the new password.
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          ...(name && !existing.name ? { name } : {}),
        },
      });
      userId = existing.id;
    } else {
      const created = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "OWNER",
        },
        select: { id: true },
      });
      userId = created.id;
    }

    // Email verification token (24h). Same VerificationToken table, scoped
    // identifier so password-reset tokens can't accidentally validate emails
    // and vice versa.
    const identifier = emailVerificationIdentifier(email);
    const { plaintext, hash } = generateResetToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h email-verify window

    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.verificationToken.create({
      data: { identifier, token: hash, expires },
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.dogshift.ch").replace(
      /\/$/,
      "",
    );
    const ctaUrl = `${appUrl}/verify-email?token=${plaintext}&email=${encodeURIComponent(email)}`;

    const rendered = renderEmailVerificationEmail({ name, ctaUrl });
    await sendEmail({
      to: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    }).catch((err) => {
      // Don't fail the registration just because the email didn't go out —
      // the user is already signed in and we can resend later.
      reportApiError({
        kind: "upstream_error",
        code: "VERIFY_EMAIL_SEND_FAILED",
        route: "auth.register",
        extra: { message: err instanceof Error ? err.message : String(err) },
      });
    });

    void userId;

    return NextResponse.json({ ok: true });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "REGISTER_FAILED",
      route: "auth.register",
      extra: { message: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
