import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function hasMissingStatusColumnError(err: unknown) {
  const e = err as { code?: string; meta?: { column_name?: string; column?: string; target?: string | string[] } };
  if (e?.code !== "P2022") return false;
  const column = String(e?.meta?.column_name ?? e?.meta?.column ?? e?.meta?.target ?? "").toLowerCase();
  return column.includes("status");
}

function errorPayload(err: unknown) {
  const e = err as {
    name?: string;
    code?: string;
    message?: string;
    stack?: string;
    meta?: unknown;
  };
  return {
    name: e?.name ?? null,
    code: e?.code ?? null,
    message: e?.message ?? null,
    meta: e?.meta ?? null,
    stack: e?.stack ?? null,
  };
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
    let amendment: any;
    try {
      const current = await (prisma as any).contractAmendment.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!current?.id) {
        return NextResponse.json({ ok: false, error: "NOT_FOUND", message: "Avenant introuvable." }, { status: 404 });
      }
      if (current.status === "DELETED") {
        return NextResponse.json(
          { ok: false, error: "DELETED_AMENDMENT", message: "Avenant supprime: activation impossible." },
          { status: 409 },
        );
      }
      await (prisma as any).contractAmendment.updateMany({
        where: { status: "ACTIVE" },
        data: { isActive: false, status: "INACTIVE", activatedAt: null },
      });
      amendment = await (prisma as any).contractAmendment.update({
        where: { id },
        data: { isActive: true, status: "ACTIVE", activatedAt: new Date() },
      });
    } catch (err) {
      if (!hasMissingStatusColumnError(err)) throw err;
      // Legacy DB fallback (status column not migrated yet)
      await (prisma as any).contractAmendment.updateMany({
        where: { isActive: true },
        data: { isActive: false, activatedAt: null },
      });
      amendment = await (prisma as any).contractAmendment.update({
        where: { id },
        data: { isActive: true, activatedAt: new Date() },
      });
      amendment = { ...amendment, status: "ACTIVE" };
      console.warn("[contract-amendment][activate][legacy-fallback]", { amendmentId: id });
    }

    console.info("[contract-amendment][activate][ok]", {
      amendmentId: id,
      nextStatus: "ACTIVE",
      isActive: true,
    });

    return NextResponse.json({ ok: true, amendment });
  } catch (err) {
    const detail = errorPayload(err);
    console.error("[api][admin][contract-amendments][activate][POST] error", detail);
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: detail.message ?? "Erreur serveur durant l'activation.",
        code: detail.code ?? null,
      },
      { status: 500 },
    );
  }
}
