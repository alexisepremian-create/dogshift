import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/agents/supervision
 * Agent Supervision : surveiller l'état des agents
 */
export async function GET() {
  try {
    const start = Date.now();

    // Dernières 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalLogs,
      errorLogs,
      runningTasks,
      recentActions,
    ] = await Promise.all([
      prisma.agentLog.count({ where: { createdAt: { gte: since } } }),
      prisma.agentLog.count({ where: { createdAt: { gte: since }, status: "error" } }),
      prisma.agentTask.count({ where: { status: { in: ["scheduled", "running"] } } }),
      prisma.agentLog.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          agentName: true,
          actionType: true,
          summary: true,
          status: true,
          durationMs: true,
          createdAt: true,
        },
      }),
    ]);

    const result = {
      status: errorLogs > 5 ? "🔴 attention" : "🟢 ok",
      period: "24h",
      totalActions: totalLogs,
      errors: errorLogs,
      errorRate: totalLogs > 0 ? `${Math.round((errorLogs / totalLogs) * 100)}%` : "0%",
      pendingTasks: runningTasks,
      recentActions,
      timestamp: new Date().toISOString(),
    };

    // Logger la supervision
    const durationMs = Date.now() - start;
    await prisma.agentLog.create({
      data: {
        agentName: "supervision_agent",
        actionType: "supervision_check",
        summary: `Supervision: ${result.status} (${result.errors} erreurs / ${result.totalActions} actions)`,
        details: result as any,
        durationMs,
        status: "success",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[agents/supervision] Error:", error);
    return NextResponse.json({ error: "Failed to check supervision" }, { status: 500 });
  }
}