import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";

/** Returns the last 30 maintenance agent runs for the admin panel. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const logs = await prisma.agentLog.findMany({
      where: { agentName: "deps-agent" },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ logs });
  } catch (err) {
    reportApiError({ kind: "internal_error", route: "GET /api/admin/maintenance", extra: { message: err instanceof Error ? err.message : String(err) } });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
