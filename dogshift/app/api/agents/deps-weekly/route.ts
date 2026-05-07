import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/agents/deps-weekly
 * Health check — returns 200 as long as the route exists.
 * The health endpoint (agents-health) uses this to mark the agent "online".
 */
export async function GET() {
  const lastLog = await prisma.agentLog.findFirst({
    where: { agentName: "deps-weekly" },
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true, summary: true },
  });

  return NextResponse.json({
    agent: "deps-weekly",
    status: "ok",
    lastRun: lastLog?.createdAt ?? null,
    lastStatus: lastLog?.status ?? null,
    lastSummary: lastLog?.summary ?? null,
  });
}

/**
 * POST /api/agents/deps-weekly
 * Called by Maestro (action: deps_weekly_run).
 * Returns the current weekly scan status.
 * Actual runs are triggered every Monday at 07h00 via GitHub Actions (deps-weekly-report.yml).
 */
export async function POST() {
  const lastLog = await prisma.agentLog.findFirst({
    where: { agentName: "deps-weekly" },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      createdAt: true,
      summary: true,
      durationMs: true,
      details: true,
    },
  });

  return NextResponse.json({
    agent: "deps-weekly",
    triggered: false,
    note: "Exécuté automatiquement chaque lundi à 07h00 via GitHub Actions (deps-weekly-report.yml)",
    lastRun: lastLog?.createdAt ?? null,
    lastStatus: lastLog?.status ?? "never",
    lastSummary: lastLog?.summary ?? "Aucune exécution enregistrée",
    durationMs: lastLog?.durationMs ?? null,
  });
}
