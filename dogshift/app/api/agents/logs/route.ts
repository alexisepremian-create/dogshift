import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/agents/logs
 * Crée un log d'agent (appelé par n8n ou les agents)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const log = await prisma.agentLog.create({
      data: {
        agentName: body.agentName,
        actionType: body.actionType,
        summary: body.summary,
        details: body.details ?? undefined,
        targetId: body.targetId ?? undefined,
        durationMs: body.durationMs ? Number(body.durationMs) : undefined,
        status: body.status ?? "success",
      },
    });

    return NextResponse.json({ success: true, id: log.id });
  } catch (error) {
    console.error("[agents/logs] Error:", error);
    return NextResponse.json({ error: "Failed to create agent log" }, { status: 500 });
  }
}

/**
 * GET /api/agents/logs?agentName=maestro&limit=50
 * Récupère les logs d'un agent
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentName = searchParams.get("agentName");
  const actionType = searchParams.get("actionType");
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const where: Record<string, any> = {};
  if (agentName) where.agentName = agentName;
  if (actionType) where.actionType = actionType;
  if (status) where.status = status;

  const logs = await prisma.agentLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(logs);
}