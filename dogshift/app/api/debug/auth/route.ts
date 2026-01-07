import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export const runtime = "nodejs";

type DebugToken = { uid?: string; sub?: string; email?: string; role?: string; sitterId?: string };

export async function GET(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as DebugToken | null;
    const uidResolved =
      (typeof token?.uid === "string" && token.uid.trim() ? token.uid.trim() : null) ??
      (typeof token?.sub === "string" && token.sub.trim() ? token.sub.trim() : null);

    return NextResponse.json(
      {
        ok: true,
        hasToken: Boolean(token),
        uidResolved,
        uid: typeof token?.uid === "string" ? token.uid : null,
        sub: typeof token?.sub === "string" ? token.sub : null,
        email: typeof token?.email === "string" ? token.email : null,
        role: typeof token?.role === "string" ? token.role : null,
        sitterId: typeof token?.sitterId === "string" ? token.sitterId : null,
      },
      { status: 200 }
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][debug][auth][GET] error", err);
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
