import { NextResponse } from "next/server";

import { getHostUserData } from "@/lib/hostUser";

export const runtime = "nodejs";

export async function GET() {
  try {
    const hostUser = await getHostUserData();
    return NextResponse.json({
      ok: true,
      contractAmendment: hostUser.contractAmendment,
    });
  } catch (err) {
    console.error("[api][host][contract-amendment][current][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
