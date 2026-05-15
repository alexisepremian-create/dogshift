import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";

/** Called by GitHub Actions with Bearer MAINTENANCE_API_KEY to store a report. */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expectedKey = (process.env.MAINTENANCE_API_KEY ?? "").trim();

  if (!expectedKey || token !== expectedKey) {
    // Diagnostic fingerprints — never logs the actual secret material, only
    // enough metadata to spot whitespace / partial paste / wrong-env issues
    // when the GitHub Actions secret and the Vercel env var disagree.
    const fp = (v: string) =>
      v.length === 0 ? "<empty>" : v.length <= 8 ? `${v} (len=${v.length})` : `${v.slice(0, 4)}…${v.slice(-4)} (len=${v.length})`;
    console.warn("[api][admin/maintenance/report] auth rejected", {
      tokenFp: fp(token),
      expectedKeyFp: fp(expectedKey),
      match: token === expectedKey,
      sameLength: token.length === expectedKey.length,
    });
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

     
    const details = JSON.parse(JSON.stringify({ packages: body.packages ?? [], durationMs: body.durationMs ?? 0 }));

    await prisma.agentLog.create({
      data: {
        agentName: "deps-agent",
        actionType: body.type ?? "nightly_update",
        summary: body.summary ?? "Dependency agent run",
         
        details,
        status: body.status ?? "success",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    reportApiError({ kind: "internal_error", route: "POST /api/admin/maintenance/report", extra: { message: err instanceof Error ? err.message : String(err) } });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
