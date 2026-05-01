import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/audit/consent
//
// Appelé côté client (CookieBanner, CguUpdateBanner) pour tracer un
// consentement dans le journal juridique. Ne stocke jamais de PII —
// uniquement des IDs techniques, la version du document, et le niveau choisi.
//
// Body: { type: "cookies" | "cgu", level?: "all" | "essential", version?: string }
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TYPES = ["cookies", "cgu"] as const;
type ConsentType = (typeof VALID_TYPES)[number];

function isValidType(v: unknown): v is ConsentType {
  return typeof v === "string" && (VALID_TYPES as readonly string[]).includes(v);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const type = body?.type;
    const level = typeof body?.level === "string" ? body.level : undefined;
    const version = typeof body?.version === "string" ? body.version : undefined;

    if (!isValidType(type)) {
      return NextResponse.json({ ok: false, error: "INVALID_TYPE" }, { status: 400 });
    }

    // Try to get authenticated user (optional — cookie consent can be anonymous)
    let actorId: string | null = null;
    try {
      const { userId } = await auth();
      actorId = userId ?? null;
    } catch {
      // Anonymous visitor — fine
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;
    const ua = req.headers.get("user-agent") ?? null;

    const action = type === "cookies" ? "consent.cookies" : "consent.cgu";

    await logAudit({
      action,
      actorType: actorId ? "user" : "system",
      actorId,
      metadata: {
        ...(level ? { level } : {}),
        ...(version ? { documentVersion: version } : {}),
        ...(ip ? { ip } : {}),
        ...(ua ? { userAgent: ua.slice(0, 200) } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][audit][consent] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
