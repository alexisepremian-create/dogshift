import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  void req;
  const res = NextResponse.json({ ok: true, passwordSet: false, lockOn: false }, { status: 200 });
  res.headers.set("cache-control", "no-store");
  return res;
}
