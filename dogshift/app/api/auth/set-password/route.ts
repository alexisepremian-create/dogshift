import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    let body: { password?: unknown; passwordConfirm?: unknown };
    try {
      body = (await req.json()) as { password?: unknown; passwordConfirm?: unknown };
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const password = typeof body.password === "string" ? body.password : "";
    const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

    if (!password || password.length < 8) {
      return NextResponse.json({ ok: false, error: "PASSWORD_TOO_SHORT" }, { status: 400 });
    }
    if (password !== passwordConfirm) {
      return NextResponse.json({ ok: false, error: "PASSWORDS_DO_NOT_MATCH" }, { status: 400 });
    }

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
