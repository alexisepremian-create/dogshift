import * as Sentry from "@sentry/nextjs";

export type AdminAuditAction =
  | "sitter.select"
  | "sitter.approve"
  | "sitter.reject"
  | "sitter.suspend"
  | "sitter.reactivate"
  | "sitter.publish"
  | "sitter.unpublish"
  | "sitter.generate_contract_link"
  | "application.status_change"
  | "account.delete"
  | "platform.settings_change";

type AuditParams = {
  action: AdminAuditAction;
  adminUserId: string | null | undefined;
  targetId?: string;
  targetType?: string;
  detail?: Record<string, unknown>;
};

/**
 * Logs a critical admin action to the console (captured by Vercel logs)
 * and as a Sentry structured event for searchability.
 *
 * No personal data should be passed in `detail` — use IDs only.
 */
export function logAdminAudit({ action, adminUserId, targetId, targetType, detail }: AuditParams) {
  const entry = {
    type: "ADMIN_AUDIT",
    action,
    adminUserId: adminUserId ?? "unknown",
    targetId: targetId ?? null,
    targetType: targetType ?? null,
    detail: detail ?? null,
    ts: new Date().toISOString(),
  };

  console.info("[audit]", JSON.stringify(entry));

  // Also capture in Sentry as a structured event (searchable in the Issues dashboard)
  Sentry.withScope((scope) => {
    scope.setTag("audit.action", action);
    scope.setTag("audit.adminUserId", adminUserId ?? "unknown");
    if (targetId) scope.setTag("audit.targetId", targetId);
    if (targetType) scope.setTag("audit.targetType", targetType);
    scope.setLevel("info");
    Sentry.captureMessage(`[AUDIT] ${action}`, { extra: entry });
  });
}
