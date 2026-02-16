import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;
  const passwordSet = Boolean(sitePassword);
  const unlockedCookie = req.cookies.get("site_unlocked")?.value;
  const lockOn = passwordSet && unlockedCookie !== "1";

  const res = NextResponse.json({ ok: true, passwordSet, lockOn }, { status: 200 });
  res.headers.set("cache-control", "no-store");
  return res;
}
