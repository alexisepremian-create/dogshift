import { NextResponse } from "next/server";

import { decodeAvatarTokenToKey, isSitterAvatarR2Key } from "@/lib/sitterAvatarMedia";
import { headObject, presignGetObject } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * Redirects to a short-lived signed URL for the R2 object.
 * Token is base64url(utf8 object key); key must be under sitter-avatars/.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const raw = typeof token === "string" ? token.trim() : "";
    if (!raw) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const key = decodeAvatarTokenToKey(decodeURIComponent(raw));
    if (!key || !isSitterAvatarR2Key(key)) {
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
    console.error("[api][media][sitter-avatar][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
