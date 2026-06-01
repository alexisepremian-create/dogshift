/**
 * POST /api/admin/impersonate/start  { userId: string }
 *
 * Verifies the caller is a fully-credentialed admin (4-layer gate via
 * `getRequestAdminAccess`), then issues a signed `ds_impersonate` cookie
 * scoped to the target user. The target MUST exist and MUST NOT be an admin
 * — we never allow admin-on-admin shadow sessions, which would let a
 * compromised admin escalate against a colleague.
 *
 * Returns `{ ok: true, redirectTo }` where `redirectTo` is the natural
 * landing page for the target's role (`/host` for sitters, `/account` for
 * owners). The client is expected to do a full-page navigation to that URL
 * so every server-component query re-runs against the impersonated identity.
 *
 * Every successful start writes a permanent `AuditLog` row with
 * `action: "admin.impersonate_start"`. Combined with the matching `_stop`
 * row, this gives a complete trail of "admin A acted as user B between t1
 * and t2", required for RGPD/nLPD compliance.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_TTL_MS,
  getImpersonationSecret,
  signImpersonationToken,
  type ImpersonationPayload,
} from "@/lib/auth/impersonation";
import { reportApiError } from "@/lib/observability/reportApiError";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const BodySchema = z.object({ userId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin || !access.userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as unknown;
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", details: parsed.error.message },
        { status: 400 },
      );
    }

    const admin = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { id: true, email: true, role: true },
    });
    if (!admin || admin.role !== "ADMIN" || !admin.email) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const target = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, role: true, sitterId: true },
    });
    if (!target) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }
    if (target.role === "ADMIN") {
      return NextResponse.json(
        { ok: false, error: "CANNOT_IMPERSONATE_ADMIN" },
        { status: 403 },
      );
    }

    const startedAt = Date.now();
    const payload: ImpersonationPayload = {
      adminId: admin.id,
      adminEmail: admin.email,
      targetUserId: target.id,
      targetEmail: target.email ?? "",
      targetRole: target.role,
      startedAt,
      expiresAt: startedAt + IMPERSONATION_TTL_MS,
    };

    const token = await signImpersonationToken(payload, getImpersonationSecret());

    // Audit BEFORE setting the cookie so we cannot end up with a started session
    // that isn't logged. PII-free: target email goes into metadata but never
    // name/phone (kept consistent with the rest of AuditLog).
    await prisma.auditLog.create({
      data: {
        action: "admin.impersonate_start",
        actorType: "admin",
        actorId: admin.id,
        targetId: target.id,
        targetType: "USER",
        metadata: {
          adminEmail: admin.email,
          targetEmail: target.email,
          targetRole: target.role,
          ttlMs: IMPERSONATION_TTL_MS,
        },
      },
    });

    const redirectTo =
      target.role === "SITTER" || (target.sitterId && target.sitterId.length > 0)
        ? "/host"
        : "/account";

    const res = NextResponse.json({ ok: true, redirectTo });
    res.cookies.set(IMPERSONATION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(IMPERSONATION_TTL_MS / 1000),
    });
    return res;
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "IMPERSONATE_START_FAILED",
      route: "api/admin/impersonate/start",
      extra: { message: String(err) },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
