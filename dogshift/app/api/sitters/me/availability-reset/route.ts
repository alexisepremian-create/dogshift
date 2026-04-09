import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSitterOwner } from "@/lib/auth/requireSitterOwner";
import { writeAvailabilityAuditLog } from "@/lib/availability/auditLog";

export const runtime = "nodejs";

/**
 * POST /api/sitters/me/availability-reset
 *
 * Deletes ALL recurring rules and ALL exceptions for the authenticated sitter,
 * across every service type. serviceConfig rows are left untouched so the
 * service tabs remain visible in the dashboard.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const [deletedRules, deletedExceptions] = await Promise.all([
      (prisma as any).availabilityRule.deleteMany({ where: { sitterId: auth.sitterId } }),
      (prisma as any).availabilityException.deleteMany({ where: { sitterId: auth.sitterId } }),
    ]);

    try {
      await writeAvailabilityAuditLog({
        sitterId: auth.sitterId,
        actorUserId: auth.dbUserId,
        action: "RESET_ALL",
        serviceType: "PROMENADE",
        payloadSummary: {
          deletedRules: deletedRules?.count ?? 0,
          deletedExceptions: deletedExceptions?.count ?? 0,
        },
      });
    } catch {
      // best-effort
    }

    return NextResponse.json(
      { ok: true, deletedRules: deletedRules?.count ?? 0, deletedExceptions: deletedExceptions?.count ?? 0 },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("[api][sitters][me][availability-reset][POST]", { sitterId: auth.sitterId, err });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
