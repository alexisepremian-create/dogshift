import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/agents/dog-news
 * Health check — always returns 200 so the health endpoint marks agent "online".
 */
export async function GET() {
  const lastLog = await prisma.agentLog.findFirst({
    where: { agentName: "dog-news" },
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true, summary: true },
  });

  return NextResponse.json({
    agent: "dog-news",
    status: "ok",
    lastRun: lastLog?.createdAt ?? null,
    lastStatus: lastLog?.status ?? null,
    lastSummary: lastLog?.summary ?? null,
  });
}

/**
 * POST /api/agents/dog-news
 * Called by Maestro (action: dog_news_run).
 * Returns the latest report metadata.
 * Actual runs happen via Vercel cron at 08:00 every day.
 */
export async function POST() {
  const lastLog = await prisma.agentLog.findFirst({
    where: { agentName: "dog-news" },
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
    agent: "dog-news",
    triggered: false,
    note: "Rapport envoyé automatiquement chaque matin à 08h00 via Vercel cron",
    lastRun: lastLog?.createdAt ?? null,
    lastStatus: lastLog?.status ?? "never",
    lastSummary: lastLog?.summary ?? "Aucun rapport envoyé",
    durationMs: lastLog?.durationMs ?? null,
  });
}
