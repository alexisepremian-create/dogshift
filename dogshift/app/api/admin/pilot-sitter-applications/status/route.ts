import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function requireAdmin(req: NextRequest) {
  const expected = (process.env.HOST_ADMIN_CODE ?? "").trim();
  const supplied = req.headers.get("x-admin-code")?.trim() ?? "";
  if (!expected || !supplied || supplied !== expected) {
    return false;
  }
  return true;
}

function isValidStatus(value: unknown): value is "PENDING" | "CONTACTED" | "ACCEPTED" | "REJECTED" {
  return value === "PENDING" || value === "CONTACTED" || value === "ACCEPTED" || value === "REJECTED";
}

export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as any;
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const status = body?.status;

    if (!id || !isValidStatus(status)) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }

    const db = prisma as unknown as {
      pilotSitterApplication: {
        update: (args: unknown) => Promise<{ id: string }>;
      };
    };

    await db.pilotSitterApplication.update({
      where: { id },
      data: { status },
      select: { id: true },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api][admin][pilot-sitter-applications][status][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
