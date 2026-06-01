/**
 * POST /api/auth/forgot-password
 *
 * Body: { email: string }
 *
 * Always responds 200 with the same body shape regardless of whether the email
 * matches a user. This avoids leaking account existence (timing-attack mitigation
 * is best-effort — see comment below).
 *
 * If the user exists AND has an email-based account, generates a single-use
 * token (1h TTL), persists its SHA-256 hash in `VerificationToken`, and emails
 * the plaintext link. We intentionally allow this for Google-only accounts too:
 * setting a password adds a Credentials login path alongside their OAuth.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderPasswordResetEmail } from "@/lib/email/templates/passwordResetEmail";
import {
  generateResetToken,
  resetTokenExpiry,
  resetTokenIdentifier,
} from "@/lib/auth/passwordResetToken";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().email().max(254),
});

const GENERIC_OK = {
  ok: true,
  message: "Si un compte existe pour cet email, tu recevras un lien de réinitialisation.",
} as const;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(GENERIC_OK);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    // Don't 400 — same generic response. Keeps the endpoint enumeration-safe.
    return NextResponse.json(GENERIC_OK);
  }

  const email = parsed.data.email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(GENERIC_OK);
    }

    const identifier = resetTokenIdentifier(email);
    const { plaintext, hash } = generateResetToken();
    const expires = resetTokenExpiry();

    // Invalidate previous outstanding tokens for this user (single active reset).
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.verificationToken.create({
      data: { identifier, token: hash, expires },
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.dogshift.ch").replace(/\/$/, "");
    const ctaUrl = `${appUrl}/reset-password?token=${plaintext}&email=${encodeURIComponent(email)}`;

    const rendered = renderPasswordResetEmail({ name: user.name ?? null, ctaUrl });

    await sendEmail(
      {
        to: email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      },
      {
        templateName: "reset-password",
        context: "api:auth/forgot-password",
        targetUserId: user.id,
      },
    );

    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "FORGOT_PASSWORD_FAILED",
      route: "auth.forgot-password",
      extra: { message: err instanceof Error ? err.message : String(err) },
    });
    // Still return generic OK so the UI never differentiates between cases.
    return NextResponse.json(GENERIC_OK);
  }
}
