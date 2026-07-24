import { NextResponse } from "next/server";

import { decodeReportPhotoTokenToKey, isReportPhotoR2Key } from "@/lib/reportPhotoMedia";
import { headObject, presignGetObject } from "@/lib/r2";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const raw = typeof token === "string" ? token.trim() : "";
    if (!raw) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const key = decodeReportPhotoTokenToKey(decodeURIComponent(raw));
    if (!key || !isReportPhotoR2Key(key)) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    try {
      await headObject({ key });
    } catch {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const { url } = await presignGetObject({ key, expiresInSeconds: 300 });
    return NextResponse.redirect(url, 307);
  } catch (err) {
    console.error("[api][media][report-photo][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
