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

export async function GET(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const services = await (prisma as any).serviceCost.findMany({
      orderBy: [{ active: "desc" }, { monthlyCost: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        type: true,
        costType: true,
        monthlyCost: true,
        notes: true,
        active: true,
        estimatedCostPerBooking: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, services }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (err) {
    const detail = errorPayload(err);
    console.error("[api][admin][service-costs][GET] error", detail);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: detail.message ?? "Unknown server error", code: detail.code ?? null },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as
      | {
          name?: string;
          type?: string;
          costType?: string;
          monthlyCost?: number;
          notes?: string;
          active?: boolean;
          estimatedCostPerBooking?: number | null;
        }
      | null;

    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
    const type = body?.type;
    const costType = body?.costType;
    const monthlyCost = Number(body?.monthlyCost);
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    const active = body?.active !== false;
    const estimatedCostPerBooking =
      body?.estimatedCostPerBooking == null ? null : Number.isFinite(Number(body.estimatedCostPerBooking)) ? Number(body.estimatedCostPerBooking) : NaN;

    if (!name || !isServiceType(type) || !isCostType(costType) || !Number.isFinite(monthlyCost) || monthlyCost < 0) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }
    if (estimatedCostPerBooking !== null && (!Number.isFinite(estimatedCostPerBooking) || estimatedCostPerBooking < 0)) {
      return NextResponse.json({ ok: false, error: "INVALID_ESTIMATED_COST_PER_BOOKING" }, { status: 400 });
    }

    const service = await (prisma as any).serviceCost.create({
      data: {
        name,
        type,
        costType,
        monthlyCost,
        notes,
        active,
        estimatedCostPerBooking,
      },
    });

    return NextResponse.json({ ok: true, service }, { status: 201 });
  } catch (err) {
    const detail = errorPayload(err);
    console.error("[api][admin][service-costs][POST] error", detail);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: detail.message ?? "Unknown server error", code: detail.code ?? null },
      { status: 500 },
    );
  }
}

