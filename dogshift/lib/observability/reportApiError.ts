import * as Sentry from "@sentry/nextjs";

/**
 * Lightweight wrapper around Sentry.captureMessage so every API error we return
 * to a client is also surfaced in Sentry with a predictable tag shape.
 *
 * Why not just let the SDK auto-capture exceptions? Because most of our bad UX
 * is NOT uncaught exceptions — it's 400/403/404 responses where the server
 * decides to say "no" on purpose (validation, auth, business rules). Those
 * never hit Sentry by default, so we can't alert on spikes.
 *
 * With `error_kind` tagged consistently we can set alert rules in Sentry like
 *   "More than 20 events where tags[error_kind] == validation_error in 10 min"
 * and get a Slack ping the moment a deploy regresses a critical form.
 *
 * No-op when Sentry isn't initialised (dev by default — see sentry.server.config.ts).
 */

export type ApiErrorKind =
  | "validation_error"
  | "forbidden"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "upstream_error"
  | "internal_error";

export interface ReportApiErrorInput {
  kind: ApiErrorKind;
  /** Machine-readable error code we return in the JSON body (e.g. "VALIDATION_ERROR"). */
  code?: string;
  /** Logical route / feature name for grouping in Sentry (e.g. "host.profile.update"). */
  route?: string;
  /** Optional structured context. Do NOT put PII here — Sentry scrubs known PII fields but don't rely on it. */
  extra?: Record<string, unknown>;
}

export function reportApiError(input: ReportApiErrorInput): void {
  const { kind, code, route, extra } = input;

  const level: Sentry.SeverityLevel =
    kind === "internal_error" || kind === "upstream_error" ? "error" : "warning";

  try {
    Sentry.captureMessage(code ?? kind.toUpperCase(), {
      level,
      tags: {
        error_kind: kind,
        ...(route ? { error_route: route } : {}),
        ...(code ? { error_code: code } : {}),
      },
      ...(extra ? { extra } : {}),
    });
  } catch {
    // Never let observability break the API response.
  }
}
