import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestAdminAccess } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const access = await getRequestAdminAccess(req);
  if (!access.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [logs24h, logs7d, lastLog] = await Promise.all([
    prisma.agentLog.findMany({
      where: { agentName: slug, createdAt: { gte: since24h } },
      select: { status: true },
    }),
    prisma.agentLog.findMany({
      where: { agentName: slug, createdAt: { gte: since7d } },
      select: { status: true, durationMs: true, createdAt: true },
    }),
    prisma.agentLog.findFirst({
      where: { agentName: slug },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, durationMs: true, status: true },
    }),
  ]);

  // 24 h counters
  const executions24h = logs24h.length;
  const errors24h = logs24h.filter((l) => l.status === "error").length;

  // 7 d success rate + avg duration
  const total7d = logs7d.length;
  const success7d = logs7d.filter((l) => l.status === "success").length;
  const successRate7d = total7d > 0 ? Math.round((success7d / total7d) * 100) : null;
  const avgDuration7d =
    total7d > 0
      ? Math.round(logs7d.reduce((acc, l) => acc + (l.durationMs ?? 0), 0) / total7d)
      : null;

  // Volume per day (last 7 days, oldest first)
  const dayMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().split("T")[0]!, 0);
  }
  for (const log of logs7d) {
    const day = log.createdAt.toISOString().split("T")[0]!;
    if (dayMap.has(day)) dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const volumePerDay = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

  // Peak hour (most active hour over last 7 days)
  const hourMap = new Map<number, number>();
  for (const log of logs7d) {
    const h = log.createdAt.getHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }
  let peakHour: number | null = null;
  let peakCount = 0;
  for (const [h, count] of hourMap.entries()) {
    if (count > peakCount) {
      peakCount = count;
      peakHour = h;
    }
  }

  return NextResponse.json({
    executions24h,
    errors24h,
    successRate7d,
    avgDuration7d,
    volumePerDay,
    peakHour,
    total7d,
    lastExecution: lastLog
      ? {
          createdAt: lastLog.createdAt.toISOString(),
          durationMs: lastLog.durationMs,
          status: lastLog.status,
        }
      : null,
  });
}
