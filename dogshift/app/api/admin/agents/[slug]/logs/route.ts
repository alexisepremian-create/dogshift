import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestAdminAccess } from "@/lib/adminAuth";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const access = await getRequestAdminAccess(req);
  if (!access.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const page = Math.max(0, Number(req.nextUrl.searchParams.get("page") ?? 0));
  const filter = req.nextUrl.searchParams.get("filter") ?? "all";

  const where: { agentName: string; status?: string } = { agentName: slug };
  if (filter === "error") where.status = "error";

  const logs = await prisma.agentLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
    select: {
      id: true,
      actionType: true,
      summary: true,
      status: true,
      durationMs: true,
      createdAt: true,
      details: true,
    },
  });

  return NextResponse.json({
    logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
    page,
    hasMore: logs.length === PAGE_SIZE,
  });
}
