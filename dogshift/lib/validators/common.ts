import { z } from "zod";
import { NextResponse } from "next/server";

import { buildValidationErrorBody } from "./zodErrorFormat";
import { reportApiError } from "@/lib/observability/reportApiError";

export type { ValidationIssue, ValidationErrorBody } from "./zodErrorFormat";
export { buildValidationErrorBody } from "./zodErrorFormat";

export interface ZodParseOptions {
  /** Logical route/feature name used as a Sentry tag for alert grouping. */
  route?: string;
}

/**
 * Helper to parse a Zod schema and return a standard 400 error on failure.
 * Returns { ok: true, data } or { ok: false, response } to short-circuit the handler.
 *
 * On failure, also reports a tagged Sentry event (`error_kind: validation_error`)
 * so we can alert on spikes — see `lib/observability/reportApiError.ts`.
 * Pass `options.route` to tag the specific endpoint for per-route alerting.
 */
export function zodParse<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  options: ZodParseOptions = {}
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const body = buildValidationErrorBody(result.error);
  reportApiError({
    kind: "validation_error",
    code: "VALIDATION_ERROR",
    route: options.route,
    extra: { issues: body.issues },
  });
  return {
    ok: false,
    response: NextResponse.json(body, { status: 400 }),
  };
}

export const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected format: YYYY-MM-DD");

export const isoDatetimeString = z
  .string()
  .refine((v) => Number.isFinite(new Date(v).getTime()), {
    message: "Expected a valid ISO datetime string",
  });
