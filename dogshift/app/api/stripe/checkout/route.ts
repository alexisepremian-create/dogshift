import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

type Body = {
  amount?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const amount = typeof body?.amount === "number" ? body.amount : NaN;

    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 1 || amount > 10000) {
      return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
    }

    const amountCents = Math.round(amount * 100);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
      return NextResponse.json({ ok: false, error: "MISSING_NEXT_PUBLIC_APP_URL" }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "chf",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "chf",
            unit_amount: amountCents,
            product_data: {
              name: "Contribution au lancement de DogShift",
              description:
                "Contribution volontaire au lancement de DogShift (phase pilote). Aucun produit / aucune contrepartie.",
            },
          },
        },
      ],
      success_url: `${baseUrl}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/annule`,
    });

    if (!session.url) {
      return NextResponse.json({ ok: false, error: "MISSING_SESSION_URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("[api][stripe][checkout] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
