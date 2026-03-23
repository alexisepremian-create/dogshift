import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: false, error: "CONTRACT_LINK_REQUIRED" }, { status: 403 });
}

export async function POST() {
  return NextResponse.json({ ok: false, error: "CONTRACT_LINK_REQUIRED" }, { status: 403 });
}
