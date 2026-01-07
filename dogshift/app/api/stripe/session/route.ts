import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";

    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_") || sessionId.length > 200) {
      return NextResponse.json({ ok: false, error: "INVALID_SESSION_ID" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json(
      {
        ok: true,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
        customer_email: session.customer_details?.email ?? null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][stripe][session] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
