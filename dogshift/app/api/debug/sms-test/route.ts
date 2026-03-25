import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { sendSms } from "@/lib/sms/sendSms";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return true;
  const expected = (process.env.DOGSHIFT_ADMIN_SECRET || "").trim();
  const provided = (req.headers.get("x-dogshift-admin-secret") || "").trim();
  return Boolean(expected) && provided === expected;
}

/**
 * GET /api/debug/sms-test?to=%2B41...
 * Optional: &text=...
 * Same auth as email-test: open in dev; in production require x-dogshift-admin-secret.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const to = (searchParams.get("to") || "").trim();
    if (!to) return NextResponse.json({ ok: false, error: "MISSING_TO" }, { status: 400 });

    const text =
      (searchParams.get("text") || "").trim() ||
      `🐶 SMS test (debug)
Message de pipeline Vonage.`;

    const res = await sendSms({ to, body: text });

    const status = res.ok ? 200 : res.skipped ? 200 : 502;
    return NextResponse.json(res, { status });
  } catch (err) {
    console.error("[api][debug][sms-test] error", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg || "INTERNAL_ERROR" }, { status: 500 });
  }
}
