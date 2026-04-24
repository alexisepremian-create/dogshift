import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { render } from "@react-email/render";
import { z } from "zod";

import { sendEmail } from "@/lib/email/sendEmail";
import {
  ActivationCodeEmail,
  activationCodeEmailPlainText,
  activationCodeEmailSubject,
} from "@/lib/email/templates/activationCodeEmail";
import { reportApiError } from "@/lib/observability/reportApiError";
import { prisma } from "@/lib/prisma";
import { baseUrlFromRequest } from "@/lib/url/baseUrlFromRequest";

export const runtime = "nodejs";

const ROUTE = "email.send-activation-code";

/**
 * Sends the "your contract is signed — here is your activation code" email.
 *
 * Designed to be called by the n8n "contract-signed" workflow right after
 * `POST /api/host/activation-code/issue`. Shared-secret protected via
 * `N8N_WEBHOOK_SECRET` — without auth, this route is a free email-flood
 * vector since the only inputs are a userId and an arbitrary string.
 *
 * The caller is responsible for providing a valid `activationCode` previously
 * returned by the issue endpoint. This route never mints codes — it only
 * renders and delivers the email.
 */

function readWebhookSecret(req: NextRequest): string {
  const header = (req.headers.get("x-webhook-secret") || "").trim();
  if (header) return header;

  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  return "";
}

const bodySchema = z.object({
  userId: z.string().trim().min(1, "userId requis").max(200),
  activationCode: z
    .string()
    .trim()
    .min(1, "activationCode requis")
    .max(64, "activationCode trop long"),
});

type ProfileLookup = {
  id: string;
  activationCodeExpiresAt: Date | null;
  user: { id: string; email: string | null; name: string | null } | null;
};

/** Returns the first word of a full name as a safe greeting token. */
function firstNameFromFullName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  const [first] = trimmed.split(/\s+/);
  return first || "";
}

export async function POST(req: NextRequest) {
  // ---------------------------------------------------------------------------
  // 1. Auth
  // ---------------------------------------------------------------------------
  const configuredSecret = (process.env.N8N_WEBHOOK_SECRET || "").trim();
  if (!configuredSecret) {
    reportApiError({
      kind: "internal_error",
      code: "MISSING_N8N_WEBHOOK_SECRET",
      route: ROUTE,
    });
    return NextResponse.json(
      { ok: false, error: "MISSING_N8N_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const providedSecret = readWebhookSecret(req);
  if (!providedSecret || providedSecret !== configuredSecret) {
    reportApiError({
      kind: "unauthorized",
      code: "UNAUTHORIZED",
      route: ROUTE,
      extra: { hasHeader: Boolean(providedSecret) },
    });
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // ---------------------------------------------------------------------------
  // 2. Body parsing + validation
  // ---------------------------------------------------------------------------
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    reportApiError({ kind: "validation_error", code: "INVALID_JSON", route: ROUTE });
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    reportApiError({
      kind: "validation_error",
      code: "VALIDATION_ERROR",
      route: ROUTE,
      extra: { issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) },
    });
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { userId, activationCode } = parsed.data;

  // ---------------------------------------------------------------------------
  // 3. Lookup sitter
  // ---------------------------------------------------------------------------
  let profile: ProfileLookup | null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic select.
    profile = (await (prisma as any).sitterProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        activationCodeExpiresAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    })) as ProfileLookup | null;
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "SITTER_LOOKUP_FAILED",
      route: ROUTE,
      extra: { message: (err as Error)?.message },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }

  if (!profile?.id) {
    reportApiError({
      kind: "not_found",
      code: "SITTER_NOT_FOUND",
      route: ROUTE,
      extra: { userIdProvided: true },
    });
    return NextResponse.json({ ok: false, error: "SITTER_NOT_FOUND" }, { status: 404 });
  }

  const email = profile.user?.email?.trim().toLowerCase();
  if (!email) {
    reportApiError({
      kind: "conflict",
      code: "SITTER_EMAIL_MISSING",
      route: ROUTE,
      extra: { sitterProfileId: profile.id },
    });
    return NextResponse.json({ ok: false, error: "SITTER_EMAIL_MISSING" }, { status: 409 });
  }

  const firstName = firstNameFromFullName(profile.user?.name);
  const baseUrl = baseUrlFromRequest(req).replace(/\/$/, "") || "https://www.dogshift.ch";
  const expiresAt =
    profile.activationCodeExpiresAt instanceof Date ? profile.activationCodeExpiresAt : null;

  // ---------------------------------------------------------------------------
  // 4. Render + send
  // ---------------------------------------------------------------------------
  const subject = activationCodeEmailSubject();
  const text = activationCodeEmailPlainText({
    firstName,
    activationCode,
    expiresAt,
    baseUrl,
  });

  let html: string;
  try {
    html = await render(
      ActivationCodeEmail({
        baseUrl,
        firstName,
        activationCode,
        expiresAt,
      }),
    );
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "EMAIL_RENDER_FAILED",
      route: ROUTE,
      extra: { message: (err as Error)?.message },
    });
    return NextResponse.json({ ok: false, error: "EMAIL_RENDER_FAILED" }, { status: 500 });
  }

  try {
    const delivery = await sendEmail({ to: email, subject, text, html });
    console.info("[api][email][send-activation-code] ok", {
      route: ROUTE,
      sitterProfileId: profile.id,
      userId,
      mode: delivery.mode,
      messageId: delivery.messageId ?? null,
    });
  } catch (err) {
    reportApiError({
      kind: "upstream_error",
      code: "EMAIL_SEND_FAILED",
      route: ROUTE,
      extra: { message: (err as Error)?.message, sitterProfileId: profile.id },
    });
    return NextResponse.json({ ok: false, error: "EMAIL_SEND_FAILED" }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
