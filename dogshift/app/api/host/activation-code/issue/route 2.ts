import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";
import {
  computeActivationCodeExpiresAt,
  generateUniqueActivationCode,
} from "@/lib/sitterActivationCode";
import { normalizeSitterLifecycleStatus } from "@/lib/sitterContract";

export const runtime = "nodejs";

const ROUTE = "host.activation-code.issue";

/**
 * Issues a fresh activation code for a sitter whose contract has been signed.
 *
 * Meant to be called by the n8n "contract-signed" workflow. Protected by the
 * shared N8N_WEBHOOK_SECRET via either `x-webhook-secret` or
 * `Authorization: Bearer <secret>`, matching the pattern used by the other
 * n8n-facing endpoints (send-application-email, sitter-applications/decision).
 *
 * The endpoint only manages the activation code lifecycle:
 *   - generates a unique DS-XXXX-XXXX code
 *   - overwrites any previous unused code (one active code per sitter)
 *   - records issuedAt + expiresAt (TTL = 7 days by default)
 *   - resets `activationCodeUsedAt` so the new code can be consumed once
 *
 * It does NOT flip `lifecycleStatus` or `published` — activation remains a
 * separate step, performed by the sitter redeeming the code via
 * POST /api/host/activation-code.
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

const issueBodySchema = z
  .object({
    userId: z.string().trim().min(1).max(200).optional(),
    sitterId: z.string().trim().min(1).max(200).optional(),
    email: z
      .string()
      .trim()
      .email("email invalide")
      .max(320)
      .optional(),
  })
  .refine((d) => Boolean(d.userId || d.sitterId || d.email), {
    message: "At least one of userId, sitterId or email is required",
    path: ["userId"],
  });

type ProfileLookup = {
  id: string;
  userId: string;
  sitterId: string;
  published: boolean;
  lifecycleStatus: string | null;
  user: { id: string; email: string | null } | null;
};

async function lookupSitterProfile(args: {
  userId?: string;
  sitterId?: string;
  email?: string;
}): Promise<ProfileLookup | null> {
  const select = {
    id: true,
    userId: true,
    sitterId: true,
    published: true,
    lifecycleStatus: true,
    user: { select: { id: true, email: true } },
  } as const;

  // Priority userId > sitterId > email — each narrow enough to hit at most one
  // row. We run in priority order (not OR'd) so an ambiguous payload never
  // picks the wrong sitter silently.
  if (args.userId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic select.
    const found = (await (prisma as any).sitterProfile.findUnique({
      where: { userId: args.userId },
      select,
    })) as ProfileLookup | null;
    if (found) return found;
  }

  if (args.sitterId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic select.
    const found = (await (prisma as any).sitterProfile.findFirst({
      where: { sitterId: args.sitterId },
      select,
    })) as ProfileLookup | null;
    if (found) return found;
  }

  if (args.email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic select.
    const found = (await (prisma as any).sitterProfile.findFirst({
      where: { user: { email: { equals: args.email, mode: "insensitive" } } },
      select,
    })) as ProfileLookup | null;
    if (found) return found;
  }

  return null;
}

export async function POST(req: NextRequest) {
  // ---------------------------------------------------------------------------
  // 1. Webhook auth
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

  const parsed = issueBodySchema.safeParse(rawBody);
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

  const { userId, sitterId, email } = parsed.data;

  // ---------------------------------------------------------------------------
  // 3. Lookup profile
  // ---------------------------------------------------------------------------
  let profile: ProfileLookup | null;
  try {
    profile = await lookupSitterProfile({ userId, sitterId, email });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "PROFILE_LOOKUP_FAILED",
      route: ROUTE,
      extra: { message: (err as Error)?.message },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }

  if (!profile?.id) {
    reportApiError({
      kind: "not_found",
      code: "SITTER_PROFILE_NOT_FOUND",
      route: ROUTE,
      extra: { byUserId: Boolean(userId), bySitterId: Boolean(sitterId), byEmail: Boolean(email) },
    });
    return NextResponse.json({ ok: false, error: "SITTER_PROFILE_NOT_FOUND" }, { status: 404 });
  }

  // ---------------------------------------------------------------------------
  // 4. Lifecycle gate — only sitters who have signed their contract qualify.
  //     `activated` is also accepted so the endpoint is idempotent and can be
  //     used to re-issue a code in support scenarios without regressing the
  //     sitter's status.
  // ---------------------------------------------------------------------------
  const lifecycle = normalizeSitterLifecycleStatus(profile.lifecycleStatus, profile.published);
  if (lifecycle !== "contract_signed" && lifecycle !== "activated") {
    reportApiError({
      kind: "conflict",
      code: "ACTIVATION_CODE_PROFILE_NOT_READY",
      route: ROUTE,
      extra: { lifecycle },
    });
    return NextResponse.json(
      { ok: false, error: "ACTIVATION_CODE_PROFILE_NOT_READY", lifecycleStatus: lifecycle },
      { status: 409 },
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Generate + persist
  // ---------------------------------------------------------------------------
  let issued: { rawCode: string; hash: string };
  try {
    issued = await generateUniqueActivationCode(prisma, {
      excludeSitterProfileId: profile.id,
    });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "ACTIVATION_CODE_GENERATION_FAILED",
      route: ROUTE,
      extra: { message: (err as Error)?.message },
    });
    return NextResponse.json(
      { ok: false, error: "ACTIVATION_CODE_GENERATION_FAILED" },
      { status: 500 },
    );
  }

  const issuedAt = new Date();
  const expiresAt = computeActivationCodeExpiresAt(issuedAt);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic update.
    await (prisma as any).sitterProfile.update({
      where: { id: profile.id },
      data: {
        activationCodeHash: issued.hash,
        activationCodeIssuedAt: issuedAt,
        activationCodeExpiresAt: expiresAt,
        activationCodeUsedAt: null,
      },
      select: { id: true },
    });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "ACTIVATION_CODE_PERSIST_FAILED",
      route: ROUTE,
      extra: { message: (err as Error)?.message, sitterProfileId: profile.id },
    });
    return NextResponse.json(
      { ok: false, error: "ACTIVATION_CODE_PERSIST_FAILED" },
      { status: 500 },
    );
  }

  console.info("[api][host][activation-code][issue] ok", {
    route: ROUTE,
    sitterProfileId: profile.id,
    userId: profile.userId,
    sitterId: profile.sitterId,
    lifecycleStatus: lifecycle,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return NextResponse.json(
    {
      ok: true,
      activationCode: issued.rawCode,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      profile: {
        userId: profile.userId,
        sitterId: profile.sitterId,
        email: profile.user?.email ?? null,
        lifecycleStatus: lifecycle,
      },
    },
    { status: 200 },
  );
}
