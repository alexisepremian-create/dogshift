import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/agents/deps-agent
 * Health check — returns 200 as long as the route exists.
 * The health endpoint (agents-health) uses this to mark the agent "online".
 */
export async function GET() {
  const lastLog = await prisma.agentLog.findFirst({
    where: { agentName: "deps-agent" },
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true, summary: true },
  });

  return NextResponse.json({
    agent: "deps-agent",
    status: "ok",
    lastRun: lastLog?.createdAt ?? null,
    lastStatus: lastLog?.status ?? null,
    lastSummary: lastLog?.summary ?? null,
  });
}

/**
 * POST /api/agents/deps-agent
 * Called by Maestro (action: deps_nightly_run).
 * Returns the current maintenance status.
 * Actual runs are triggered nightly by GitHub Actions — no manual dispatch here.
 */
export async function POST() {
  const lastLog = await prisma.agentLog.findFirst({
    where: { agentName: "deps-agent" },
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
    agent: "deps-agent",
    triggered: false,
    note: "Exécuté automatiquement chaque nuit à 02h00 via GitHub Actions (deps-nightly.yml)",
    lastRun: lastLog?.createdAt ?? null,
    lastStatus: lastLog?.status ?? "never",
    lastSummary: lastLog?.summary ?? "Aucune exécution enregistrée",
    durationMs: lastLog?.durationMs ?? null,
  });
}
