import { NextRequest, NextResponse } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";

export const runtime = "nodejs";

const BASE = (process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const SLUG_TO_PATH: Record<string, string> = {
  maestro:                  "/api/maestro",
  "lead-magnet":            "/api/agents/lead-magnet",
  "onboarding-owner":       "/api/agents/onboarding-owner",
  "zootherapie-evaluation": "/api/agents/zootherapie-evaluation",
  candidature:              "/api/agents/candidature-enriched",
  "candidature-enriched":   "/api/agents/candidature-enriched",
  "candidature-ai-review":  "/api/agents/candidature-ai-review",
  booking:                  "/api/agents/booking",
  notification:             "/api/agents/notification",
  notifications:            "/api/agents/notification",
  calendrier:               "/api/agents/calendrier",
  contrat:                  "/api/agents/contrat",
  activation:               "/api/agents/activation",
  availability:             "/api/agents/availability",
  supervision:              "/api/agents/supervision",
  "pension-verification":   "/api/agents/pension-verification",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const access = await getRequestAdminAccess(req);
  if (!access.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const path = SLUG_TO_PATH[slug];
  if (!path) {
    return NextResponse.json({ error: `No route configured for agent: ${slug}` }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const url = `${BASE}${path}`;
  const t0 = Date.now();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: unknown = await res.json().catch(() => ({}));
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - t0,
      response: json,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, durationMs: Date.now() - t0 },
      { status: 502 }
    );
  }
}
