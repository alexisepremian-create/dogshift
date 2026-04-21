import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * Helper to parse a Zod schema and return a standard 400 error on failure.
 * Returns { ok: true, data } or { ok: false, response } to short-circuit the handler.
 */
export function zodParse<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues.map((i) => ({
    field: i.path.join("."),
    message: i.message,
  }));
  // Human-readable summary so the client can show what actually failed instead of
  // a bare "VALIDATION_ERROR" code. Keeps the structured `issues` for programmatic use.
  const details = issues
    .map((i) => (i.field ? `${i.field}: ${i.message}` : i.message))
    .filter((s) => s && s.length > 0)
    .join("; ");
  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        error: "VALIDATION_ERROR",
        issues,
        ...(details ? { details } : {}),
      },
      { status: 400 }
    ),
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
