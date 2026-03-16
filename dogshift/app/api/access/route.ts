import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    void req;
    return NextResponse.json({ ok: true, disabled: true }, { status: 200 });
  } catch (err) {
    console.error("[api][access] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
