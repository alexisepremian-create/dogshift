import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function pilotModeBypassEnabled() {
  const raw = (process.env.PILOT_MODE || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const acceptanceCount = await (prisma as any).sitterContractAmendmentAcceptance.count({
      where: { amendmentId: id },
    });
    const bypass = pilotModeBypassEnabled();
    if (acceptanceCount > 0 && !bypass) {
      return NextResponse.json({ ok: false, error: "AMENDMENT_HAS_SIGNATURES" }, { status: 409 });
    }

    const amendment = await (prisma as any).contractAmendment.update({
      where: { id },
      data: { isActive: false, status: "DELETED", activatedAt: null },
    });

    console.info("[contract-amendment][delete][soft]", {
      amendmentId: id,
      acceptanceCount,
      pilotModeBypass: bypass,
    });

    return NextResponse.json({ ok: true, amendment });
  } catch (err) {
    console.error("[api][admin][contract-amendments][delete][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

