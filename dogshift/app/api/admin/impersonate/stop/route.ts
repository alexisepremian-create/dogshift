/**
 * POST /api/admin/impersonate/stop
 *
 * Clears the `ds_impersonate` cookie and audit-logs the end of the session.
 * Deliberately permissive on auth — anyone presenting the cookie can call
 * this to exit (otherwise an admin who somehow lost their admin gate
 * mid-session would be stuck impersonating until expiry). What we DO require:
 *
 *   - the cookie verifies cleanly (the audit row needs the admin identity)
 *
 * If the cookie is missing or invalid we just clear and return ok — the
 * client wants to escape impersonation regardless.
 */
import { NextResponse, type NextRequest } from "next/server";

import {
  IMPERSONATION_COOKIE,
  getImpersonationSecret,
  verifyImpersonationToken,
} from "@/lib/auth/impersonation";
import { reportApiError } from "@/lib/observability/reportApiError";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const raw = req.cookies.get(IMPERSONATION_COOKIE)?.value;
    const payload = raw
      ? await verifyImpersonationToken(raw, getImpersonationSecret())
      : null;

    if (payload) {
      const durationMs = Date.now() - payload.startedAt;
      await prisma.auditLog.create({
        data: {
          action: "admin.impersonate_stop",
          actorType: "admin",
          actorId: payload.adminId,
          targetId: payload.targetUserId,
          targetType: "USER",
          metadata: {
            adminEmail: payload.adminEmail,
            targetEmail: payload.targetEmail,
            durationMs,
          },
        },
      });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(IMPERSONATION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "IMPERSONATE_STOP_FAILED",
      route: "api/admin/impersonate/stop",
      extra: { message: String(err) },
    });
    // Still clear the cookie even if the audit write failed.
    const res = NextResponse.json({ ok: true, warning: "audit_failed" });
    res.cookies.set(IMPERSONATION_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }
}
