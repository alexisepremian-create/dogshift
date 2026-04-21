import type { ZodError } from "zod";

/**
 * Pure formatting helpers for turning a Zod error into the JSON body we send
 * back to clients. Deliberately Next-free so unit tests can import it without
 * dragging in `next/server` (which does not resolve cleanly under
 * `node --test --experimental-strip-types`).
 */

export type ValidationIssue = { field: string; message: string };

export type ValidationErrorBody = {
  ok: false;
  error: "VALIDATION_ERROR";
  issues: ValidationIssue[];
  details?: string;
};

export function buildValidationErrorBody(error: ZodError): ValidationErrorBody {
  const issues = error.issues.map((i) => ({
    field: i.path.join("."),
    message: i.message,
  }));
  const details = issues
    .map((i) => (i.field ? `${i.field}: ${i.message}` : i.message))
    .filter((s) => s && s.length > 0)
    .join("; ");
  return {
    ok: false,
    error: "VALIDATION_ERROR",
    issues,
    ...(details ? { details } : {}),
  };
}
