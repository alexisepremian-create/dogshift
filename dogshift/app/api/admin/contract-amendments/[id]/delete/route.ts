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

function pilotModeBypassEnabled() {
  const raw = (process.env.PILOT_MODE || "").trim().toLowerCase();
  // Pilot-first default: if var is missing, keep delete soft-allowed even with signatures.
  if (!raw) return true;
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

    const current = await (prisma as any).contractAmendment.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!current?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND", message: "Avenant introuvable." }, { status: 404 });
    }

    const acceptanceCount = await (prisma as any).sitterContractAmendmentAcceptance.count({
      where: { amendmentId: id },
    });
    const bypass = pilotModeBypassEnabled();
    if (acceptanceCount > 0 && !bypass) {
      return NextResponse.json(
        {
          ok: false,
          error: "AMENDMENT_HAS_SIGNATURES",
          message: "Suppression bloquee: signatures existantes.",
          acceptanceCount,
        },
        { status: 409 },
      );
    }

    let amendment: any;
    try {
      amendment = await (prisma as any).contractAmendment.update({
        where: { id },
        data: { isActive: false, status: "DELETED", activatedAt: null },
      });
    } catch (err) {
      if (!hasMissingStatusColumnError(err)) throw err;
      // Legacy DB fallback (status column not migrated yet)
      amendment = await (prisma as any).contractAmendment.update({
        where: { id },
        data: {
          isActive: false,
          activatedAt: null,
        },
      });
      amendment = { ...amendment, status: "DELETED" };
      console.warn("[contract-amendment][delete][legacy-fallback]", {
        amendmentId: id,
        acceptanceCount,
        pilotModeBypass: bypass,
      });
    }

    console.info("[contract-amendment][delete][soft]", {
      amendmentId: id,
      acceptanceCount,
      pilotModeBypass: bypass,
      nextStatus: "DELETED",
    });

    return NextResponse.json({ ok: true, amendment });
  } catch (err) {
    const detail = errorPayload(err);
    console.error("[api][admin][contract-amendments][delete][POST] error", detail);
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: detail.message ?? "Erreur serveur durant la suppression.",
        code: detail.code ?? null,
      },
      { status: 500 },
    );
  }
}

