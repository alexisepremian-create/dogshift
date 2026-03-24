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

    await (prisma as any).contractAmendment.updateMany({ where: { isActive: true }, data: { isActive: false, activatedAt: null } });
    const amendment = await (prisma as any).contractAmendment.update({
      where: { id },
      data: { isActive: true, activatedAt: new Date() },
    });

    return NextResponse.json({ ok: true, amendment });
  } catch (err) {
    console.error("[api][admin][contract-amendments][activate][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
