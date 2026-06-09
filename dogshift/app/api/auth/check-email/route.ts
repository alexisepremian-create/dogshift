/**
 * POST /api/auth/check-email — email-first auth probe.
 *
 * Powers the unified "email-first" login/signup flow (à la Airbnb): the client
 * submits an email, and we tell it whether an account exists and whether it has
 * a password set. The client then shows either the login step (existing
 * account) or the signup step (new account).
 *
 * Response:
 *   { ok: true, exists: boolean, hasPassword: boolean }
 *     - exists=false                 → new account → signup step
 *     - exists=true,  hasPassword=true  → login step (email + password)
 *     - exists=true,  hasPassword=false → login step with "use Google / set a
 *       password" hint (Google-only or migrated account → authorize() would
 *       throw MIGRATED_NO_PASSWORD).
 *
 * Note on enumeration: this endpoint intentionally reveals whether an email is
 * registered. That's inherent to an email-first UX (Google/Airbnb do the same).
 * The password-reset endpoint stays anti-enumeration on its own side.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().email().max(254),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    return NextResponse.json({
      ok: true,
      exists: !!user,
      hasPassword: !!user?.passwordHash,
    });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "CHECK_EMAIL_FAILED",
      route: "auth.check-email",
      extra: { message: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
