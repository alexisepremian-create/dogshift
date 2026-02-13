import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    void req;
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][debug][auth][GET] error", err);
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
