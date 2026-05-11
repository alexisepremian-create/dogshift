import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Clerk webhook handler — now a no-op (PR 2 of the Clerk → Auth.js migration).
 *
 * After PR 2 ships, Clerk is no longer the active auth provider, but the
 * webhook URL may still receive a few delayed events from Clerk's queue
 * during the transition window. We respond with 200 OK so Clerk stops
 * retrying, and log just enough to know events arrived.
 *
 * This entire route is deleted in PR 3 along with the Clerk packages.
 */
export async function POST(req: Request) {
  try {
    const text = await req.text();
    const length = text.length;
    console.info("[webhooks][clerk][noop]", { length });
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true, note: "clerk webhook no-op (migrated to Auth.js)" });
}

export async function GET() {
  return NextResponse.json({ ok: true, note: "clerk webhook no-op (migrated to Auth.js)" });
}
