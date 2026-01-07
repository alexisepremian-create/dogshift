import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function baseUrlFromHeaders(req: NextRequest) {
  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
  const host =
    (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() ||
    (req.headers.get("host") || "").split(",")[0]?.trim() ||
    "";
  if (!host) return "";
  return `${proto}://${host}`;
}

function isLocalhostUrl(url: string) {
  const u = url.toLowerCase();
  return u.includes("localhost") || u.includes("127.0.0.1") || u.includes("0.0.0.0");
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const nextAuthUrl = (process.env.NEXTAUTH_URL || "").trim();
  const resend = Boolean((process.env.RESEND_API_KEY || "").trim());
  const from = (process.env.EMAIL_FROM || "").trim();
  const derivedBaseUrl = baseUrlFromHeaders(req);

  return NextResponse.json(
    {
      ok: true,
      env: {
        NEXTAUTH_URL: nextAuthUrl || null,
        RESEND_API_KEY: resend ? "set" : null,
        EMAIL_FROM: from || null,
        derivedBaseUrl: derivedBaseUrl || null,
        derivedBaseUrlLooksLocal: derivedBaseUrl ? isLocalhostUrl(derivedBaseUrl) : null,
      },
      notes: {
        resendRequiresEmailFrom: resend ? !from : null,
        baseUrlSource: nextAuthUrl ? "NEXTAUTH_URL" : "headers",
      },
    },
    { status: 200 }
  );
}
