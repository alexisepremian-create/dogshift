import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SERVICE_TYPES = ["hosting", "db", "payment", "email", "auth", "other"] as const;
const COST_TYPES = ["fixed", "variable"] as const;

function isServiceType(value: unknown): value is (typeof SERVICE_TYPES)[number] {
  return typeof value === "string" && (SERVICE_TYPES as readonly string[]).includes(value);
}

function isCostType(value: unknown): value is (typeof COST_TYPES)[number] {
  return typeof value === "string" && (COST_TYPES as readonly string[]).includes(value);
}

function errorPayload(err: unknown) {
  const e = err as { name?: string; code?: string; message?: string; stack?: string; meta?: unknown };
  return {
    name: e?.name ?? null,
    code: e?.code ?? null,
    message: e?.message ?? null,
    meta: e?.meta ?? null,
    stack: e?.stack ?? null,
  };
}

let _tableExists: boolean | null = null;

async function serviceCostTableExists(): Promise<boolean> {
  if (_tableExists !== null) return _tableExists;
  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'ServiceCost'
      ) AS "exists"`;
    _tableExists = rows[0]?.exists === true;
  } catch {
    _tableExists = false;
  }
  return _tableExists;
}

const MIGRATION_PENDING_RESPONSE = { ok: false, error: "MIGRATION_PENDING", message: "La table ServiceCost n'existe pas encore." } as const;

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (!(await serviceCostTableExists())) {
      return NextResponse.json(MIGRATION_PENDING_RESPONSE, { status: 503 });
    }

    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as
      | {
          name?: string;
          type?: string;
          costType?: string;
          monthlyCost?: number;
          notes?: string | null;
          active?: boolean;
          estimatedCostPerBooking?: number | null;
        }
      | null;

    const data: Record<string, unknown> = {};
    if (typeof body?.name === "string") {
      const v = body.name.trim().slice(0, 120);
      if (!v) return NextResponse.json({ ok: false, error: "INVALID_NAME" }, { status: 400 });
      data.name = v;
    }
    if (body?.type != null) {
      if (!isServiceType(body.type)) return NextResponse.json({ ok: false, error: "INVALID_TYPE" }, { status: 400 });
      data.type = body.type;
    }
    if (body?.costType != null) {
      if (!isCostType(body.costType)) return NextResponse.json({ ok: false, error: "INVALID_COST_TYPE" }, { status: 400 });
      data.costType = body.costType;
    }
    if (body?.monthlyCost != null) {
      const v = Number(body.monthlyCost);
      if (!Number.isFinite(v) || v < 0) return NextResponse.json({ ok: false, error: "INVALID_MONTHLY_COST" }, { status: 400 });
      data.monthlyCost = v;
    }
    if (body?.notes !== undefined) {
      data.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    }
    if (typeof body?.active === "boolean") {
      data.active = body.active;
    }
    if (body?.estimatedCostPerBooking !== undefined) {
      if (body.estimatedCostPerBooking == null) {
        data.estimatedCostPerBooking = null;
      } else {
        const v = Number(body.estimatedCostPerBooking);
        if (!Number.isFinite(v) || v < 0) {
          return NextResponse.json({ ok: false, error: "INVALID_ESTIMATED_COST_PER_BOOKING" }, { status: 400 });
        }
        data.estimatedCostPerBooking = v;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "NO_UPDATES" }, { status: 400 });
    }

    const service = await (prisma as any).serviceCost.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, service }, { status: 200 });
  } catch (err) {
    const detail = errorPayload(err);
    console.error("[api][admin][service-costs][id][PATCH] error", detail);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: detail.message ?? "Unknown server error", code: detail.code ?? null },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (!(await serviceCostTableExists())) {
      return NextResponse.json(MIGRATION_PENDING_RESPONSE, { status: 503 });
    }

    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

    await (prisma as any).serviceCost.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const detail = errorPayload(err);
    console.error("[api][admin][service-costs][id][DELETE] error", detail);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: detail.message ?? "Unknown server error", code: detail.code ?? null },
      { status: 500 },
    );
  }
}

