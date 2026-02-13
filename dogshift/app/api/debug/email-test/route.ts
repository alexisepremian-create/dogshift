import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return true;
  const expected = (process.env.DOGSHIFT_ADMIN_SECRET || "").trim();
  const provided = (req.headers.get("x-dogshift-admin-secret") || "").trim();
  return Boolean(expected) && provided === expected;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const to = (searchParams.get("to") || "").trim();
    if (!to) return NextResponse.json({ ok: false, error: "MISSING_TO" }, { status: 400 });

    const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "").trim().replace(/\/$/, "");
    const logoUrl = baseUrl ? `${baseUrl}/dogshift-logo.png` : "";

    const html = renderEmailLayout({
      logoUrl,
      title: "Email test",
      subtitle: "Test de la pipeline Resend / SMTP.",
      summaryRows: [{ label: "Destinataire", value: to }],
      ctaLabel: baseUrl ? "Ouvrir DogShift" : undefined,
      ctaUrl: baseUrl ? `${baseUrl}/account` : undefined,
    }).html;

    const res = await sendEmail({
      to,
      subject: "DogShift — Email test",
      text: "Email test DogShift.",
      html,
    });

    return NextResponse.json({ ok: true, mode: res.mode }, { status: 200 });
  } catch (err) {
    console.error("[api][debug][email-test] error", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg || "INTERNAL_ERROR" }, { status: 500 });
  }
}
