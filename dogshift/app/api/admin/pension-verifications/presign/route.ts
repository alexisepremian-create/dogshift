import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestAdminAccess } from "@/lib/adminAuth";
import { presignGetObject } from "@/lib/r2";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as null | { fileKey?: string };
    const fileKey = typeof body?.fileKey === "string" ? body.fileKey.trim() : "";

    if (!fileKey || !fileKey.startsWith("pension-verification/")) {
      return NextResponse.json({ ok: false, error: "INVALID_KEY" }, { status: 400 });
    }

    const { url, expiresIn } = await presignGetObject({ key: fileKey, expiresInSeconds: 300 });
    return NextResponse.json({ ok: true, url, expiresIn });
  } catch (err) {
    console.error("[api][admin][pension-verifications][presign]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
