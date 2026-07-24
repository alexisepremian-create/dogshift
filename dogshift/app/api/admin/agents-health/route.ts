import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";

export const runtime = "nodejs";

type AgentStatus = "online" | "offline" | "unknown";

/**
 * Maps agent IDs (as used in the admin hierarchy canvas) to the API path
 * that should be pinged to check liveness.
 *
 * null  = no physical route exists yet → always returns "unknown"
 * string = path relative to the app base URL
 */
const ROUTE_MAP: Record<string, string | null> = {
  maestro:             "/api/maestro",
  candidature:         "/api/agents/candidature-enriched",
  candidature_classic: "/api/agents/candidature",
  candidature_ai:      "/api/agents/candidature-ai-review",
  calendrier:          "/api/agents/calendrier",
  contrat:             "/api/agents/contrat",
  activation:          "/api/agents/activation",
  booking:             "/api/agents/booking",
  notifications:       "/api/agents/notification",
  "lead-magnet":             "/api/agents/lead-magnet",
  "onboarding-owner":        "/api/agents/onboarding-owner",
  "zootherapie-evaluation":  "/api/agents/zootherapie-evaluation",
  "deps-agent":              "/api/agents/deps-agent",
  "deps-weekly":             "/api/agents/deps-weekly",
  "dog-news":                "/api/agents/dog-news",
  "bug-regression-check":    "/api/cron/bug-regression-check",
  "prisma-migration-status": "/api/cron/prisma-migration-status",
  "profile-health":          "/api/cron/profile-health-check",
  "service-reports":         "/api/cron/service-reports",
  // No dedicated route yet
  auth:                null,
  reservations:        null,
  assistant:           null,
};

/**
 * Pings a single route and maps the HTTP response to an AgentStatus.
 *
 * Status code interpretation (per spec):
 *   200 / 400 / 401 / 405 → "online"  (agent is alive, even if method not allowed)
 *   404                   → "unknown" (route doesn't exist)
 *   5xx                   → "offline" (agent crashed)
 *   network error / timeout → "offline"
 */
async function pingRoute(baseUrl: string, path: string): Promise<AgentStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      signal: controller.signal,
      // No credentials needed — 401 still counts as "online"
    });

    if (res.status === 404) return "unknown";
    if (res.status >= 500) return "offline";
    return "online";
  } catch {
    // AbortError (timeout) or network failure
    return "offline";
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const access = await getRequestAdminAccess(req);
  if (!access.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Derive base URL from the incoming request so it works in every environment
  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  const rawIds = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = rawIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const toCheck = ids.length > 0 ? ids : Object.keys(ROUTE_MAP);

  const results: Record<string, AgentStatus> = {};

  await Promise.all(
    toCheck.map(async (id) => {
      const path = ROUTE_MAP[id];
      if (path == null) {
        results[id] = "unknown";
      } else {
        results[id] = await pingRoute(baseUrl, path);
      }
    })
  );

  return NextResponse.json({ results });
}
