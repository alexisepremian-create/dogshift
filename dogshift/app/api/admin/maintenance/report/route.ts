import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";

/** Called by GitHub Actions with Bearer MAINTENANCE_API_KEY to store a report. */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expectedKey = (process.env.MAINTENANCE_API_KEY ?? "").trim();

  if (!expectedKey || token !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as {
      type?: string;
      status?: string;
      packages?: unknown;
      durationMs?: number;
      summary?: string;
    };

    await prisma.agentLog.create({
      data: {
        agentName: "deps-agent",
        actionType: body.type ?? "nightly_update",
        summary: body.summary ?? "Dependency agent run",
        details: { packages: body.packages, durationMs: body.durationMs },
        status: body.status ?? "success",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    reportApiError(err, { route: "POST /api/admin/maintenance/report" });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
