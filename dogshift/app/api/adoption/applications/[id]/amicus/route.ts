import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { loadApplicationAccess } from "@/lib/adoption/access";
import { amicusDeadline } from "@/lib/adoption/legal";

export const runtime = "nodejs";

/**
 * POST — the cédant confirms the AMICUS transfer declaration is filed.
 *
 * OFE art. 16-18: after a cession, *both* parties must declare the change of
 * keeper to the AMICUS database within 10 days. DogShift can't file it for them
 * (it's done at the cantonal AMICUS portal), so the platform's only useful role
 * is to remind, then record that it's done — that's what the reminder cron
 * (PR4) reads to stop nagging.
 *
 * One timestamp, one signer: the cédant is the party the deadline actually bites
 * (they stay the registered keeper until the transfer is declared), so they are
 * the one who acknowledges it. Tracking both signatures separately would need
 * two columns and would still be self-declared.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const access = await loadApplicationAccess(id, user.id);
    if (!access) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (!access.isCedant) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const row = await prisma.adoptionApplication.findUniqueOrThrow({
      where: { id },
      select: { id: true, adoptedAt: true, amicusConfirmedAt: true },
    });
    if (!row.adoptedAt) {
      return NextResponse.json({ ok: false, error: "NOT_ADOPTED_YET" }, { status: 409 });
    }
    if (row.amicusConfirmedAt) {
      return NextResponse.json({
        ok: true,
        amicusConfirmedAt: row.amicusConfirmedAt,
        deadline: amicusDeadline(row.adoptedAt),
      });
    }

    const now = new Date();
    const updated = await prisma.adoptionApplication.update({
      where: { id },
      data: { amicusConfirmedAt: now },
      select: { amicusConfirmedAt: true },
    });

    return NextResponse.json({
      ok: true,
      amicusConfirmedAt: updated.amicusConfirmedAt,
      deadline: amicusDeadline(row.adoptedAt),
    });
  } catch (err) {
    console.error("[POST /api/adoption/applications/[id]/amicus]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.applications.amicus" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
