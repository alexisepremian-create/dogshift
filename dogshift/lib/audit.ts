import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditActorType = "admin" | "user" | "system" | "stripe";

export type AuditAction =
  // Booking lifecycle
  | "booking.created"
  | "booking.paid"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.refunded"
  // Sitter admin actions
  | "sitter.select"
  | "sitter.approve"
  | "sitter.reject"
  | "sitter.suspend"
  | "sitter.reactivate"
  | "sitter.publish"
  | "sitter.unpublish"
  | "sitter.generate_contract_link"
  // Applications
  | "application.status_change"
  // Account / RGPD
  | "account.delete"
  // Platform
  | "platform.settings_change"
  // Communications
  | "communications.email_sent";

type LogAuditParams = {
  action: AuditAction;
  actorType: AuditActorType;
  actorId?: string | null;
  targetId?: string | null;
  targetType?: string | null;
  metadata?: Record<string, unknown> | null;
};

// ─── Core logger ─────────────────────────────────────────────────────────────

/**
 * Persists an audit entry to the database (AuditLog table), the server console,
 * and Sentry as a structured info event.
 *
 * Fire-and-forget safe — errors are caught and logged to Sentry so they never
 * crash the calling request.
 *
 * Rules:
 * - Never store PII (email, name, phone) in metadata — IDs only.
 * - Every critical action on the platform should call this function.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  const { action, actorType, actorId, targetId, targetType, metadata } = params;

  const entry = {
    action,
    actorType,
    actorId: actorId ?? null,
    targetId: targetId ?? null,
    targetType: targetType ?? null,
    metadata: metadata ?? null,
  };

  // 1. Persist to DB (never throws — caught below)
  try {
    await (prisma as any).auditLog.create({ data: entry });
  } catch (dbErr) {
    console.error("[audit] DB write failed", { action, dbErr });
    Sentry.captureException(dbErr, { extra: entry });
  }

  // 2. Structured console log (captured by Vercel logs)
  console.info("[audit]", JSON.stringify({ ...entry, ts: new Date().toISOString() }));

  // 3. Sentry structured event (searchable in Issues dashboard)
  Sentry.withScope((scope) => {
    scope.setTag("audit.action", action);
    scope.setTag("audit.actorType", actorType);
    if (actorId) scope.setTag("audit.actorId", actorId);
    if (targetId) scope.setTag("audit.targetId", targetId);
    if (targetType) scope.setTag("audit.targetType", targetType);
    scope.setLevel("info");
    Sentry.captureMessage(`[AUDIT] ${action}`, { extra: entry });
  });
}

// ─── Backward-compat shim (replaces lib/adminAudit.ts) ───────────────────────

/** @deprecated use logAudit() directly */
export async function logAdminAudit(params: {
  action: AuditAction;
  adminUserId?: string | null;
  targetId?: string;
  targetType?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  return logAudit({
    action: params.action,
    actorType: "admin",
    actorId: params.adminUserId,
    targetId: params.targetId,
    targetType: params.targetType,
    metadata: params.detail ?? null,
  });
}
