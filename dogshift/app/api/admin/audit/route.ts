import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestAdminAccess } from "@/lib/adminAuth";

export const runtime = "nodejs";

const PAGE_SIZE = 100;

/** GET /api/admin/audit
 *  Query params:
 *  - page (number, default 1)
 *  - action (string, optional filter)
 *  - format=csv  → download full log as CSV
 */
export async function GET(req: NextRequest) {
  const admin = await getRequestAdminAccess(req);
  if (!admin.isAdmin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");
  const actionFilter = searchParams.get("action") ?? "";

  const where = actionFilter ? { action: actionFilter } : {};

  // ── CSV export ───────────────────────────────────────────────────────────
  if (format === "csv") {
    const rows = await (prisma as any).auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    const header = ["id", "createdAt", "action", "actorType", "actorId", "targetType", "targetId", "metadata"];
    const escape = (v: unknown) => {
      const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [
      header.join(","),
      ...rows.map((r: any) =>
        [r.id, r.createdAt?.toISOString() ?? "", r.action, r.actorType, r.actorId ?? "", r.targetType ?? "", r.targetId ?? "", r.metadata]
          .map(escape)
          .join(",")
      ),
    ];

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dogshift-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ── JSON paginated ───────────────────────────────────────────────────────
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const skip = (page - 1) * PAGE_SIZE;

  const [total, rows] = await Promise.all([
    (prisma as any).auditLog.count({ where }),
    (prisma as any).auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    total,
    page,
    pageSize: PAGE_SIZE,
    rows,
  });
}
