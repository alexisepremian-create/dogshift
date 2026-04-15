import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

import { zodParse } from "@/lib/validators/common";
import { setPasswordSchema } from "@/lib/validators/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const parsed = zodParse(setPasswordSchema, rawBody);
    if (!parsed.ok) return parsed.response;

    const { password } = parsed.data;

    const client = await clerkClient();
    await client.users.updateUser(userId, { password });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auth][set-password] error", { message });

    // Clerk may throw errors with a specific status — surface them gracefully
    if (
      message.toLowerCase().includes("password") ||
      message.toLowerCase().includes("weak") ||
      message.toLowerCase().includes("pwned")
    ) {
      return NextResponse.json({ ok: false, error: "PASSWORD_REJECTED", detail: message }, { status: 422 });
    }

    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
