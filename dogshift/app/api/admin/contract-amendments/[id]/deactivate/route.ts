import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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
    const current = await (prisma as any).contractAmendment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!current?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (current.status === "DELETED") {
      return NextResponse.json({ ok: false, error: "DELETED_AMENDMENT" }, { status: 409 });
    }

    const amendment = await (prisma as any).contractAmendment.update({
      where: { id },
      data: { isActive: false, status: "INACTIVE", activatedAt: null },
    });

    return NextResponse.json({ ok: true, amendment });
  } catch (err) {
    console.error("[api][admin][contract-amendments][deactivate][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

