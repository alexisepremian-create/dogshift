import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

type Body = {
  amount?: unknown;
};

async function readAmount(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as Body;
    return typeof body?.amount === "number" ? body.amount : NaN;
  }

  const form = await req.formData();
  const raw = form.get("amount");
  if (typeof raw !== "string") return NaN;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const expectsRedirect = !contentType.includes("application/json");
    const amount = await readAmount(req);

    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 1 || amount > 10000) {
      if (expectsRedirect) {
        return NextResponse.redirect(new URL("/contribuer?canceled=1", req.url), { status: 303 });
      }
      return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
    }

    const amountCents = Math.round(amount * 100);
    const requiresShipping = amount >= 50;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) {
      if (expectsRedirect) {
        return NextResponse.redirect(new URL("/contribuer?canceled=1", req.url), { status: 303 });
      }
      return NextResponse.json({ ok: false, error: "MISSING_NEXT_PUBLIC_APP_URL" }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "chf",
      ...(requiresShipping
        ? {
            shipping_address_collection: {
              allowed_countries: ["CH"],
            },
          }
        : {}),
      name_collection: {
        individual: {
          enabled: true,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "chf",
            unit_amount: amountCents,
            product_data: {
              name: "Contribution au lancement de DogShift",
              description:
                "Contribution volontaire au lancement de DogShift (phase pilote). Aucun produit n’est vendu. Les contributions ≥ 50 CHF peuvent recevoir un T-shirt DogShift Founder Edition en remerciement.",
            },
          },
        },
      ],
      success_url: `${baseUrl}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/contribuer?canceled=1`,
    });

    if (!session.url) {
      if (expectsRedirect) {
        return NextResponse.redirect(new URL("/contribuer?canceled=1", req.url), { status: 303 });
      }
      return NextResponse.json({ ok: false, error: "MISSING_SESSION_URL" }, { status: 500 });
    }

    if (expectsRedirect) {
      return NextResponse.redirect(session.url, { status: 303 });
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("[api][stripe][checkout] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
