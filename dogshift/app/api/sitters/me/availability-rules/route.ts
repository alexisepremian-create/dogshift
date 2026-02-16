import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSitterOwner } from "@/lib/auth/requireSitterOwner";
import type { ServiceType } from "@/lib/availability/slotEngine";
import { normalizeRanges } from "@/lib/availability/rangeValidation";

export const runtime = "nodejs";

function normalizeService(value: string): ServiceType | null {
  const v = value.trim().toUpperCase();
  if (v === "PROMENADE" || v === "DOGSITTING" || v === "PENSION") return v;
  return null;
}

type PutBody = {
  dayOfWeek?: unknown;
  status?: unknown;
  ranges?: unknown;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const serviceType = normalizeService(url.searchParams.get("service") ?? "");
  if (!serviceType) return NextResponse.json({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });

  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const rows = await (prisma as any).availabilityRule.findMany({
    where: { sitterId: auth.sitterId, serviceType },
    orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }],
    select: { id: true, dayOfWeek: true, startMin: true, endMin: true, status: true },
  });

  return NextResponse.json({ ok: true, sitterId: auth.sitterId, serviceType, rules: rows ?? [] }, { status: 200, headers: { "cache-control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  const startedAt = Date.now();
  const url = new URL(req.url);
  const serviceType = normalizeService(url.searchParams.get("service") ?? "");
  if (!serviceType) return NextResponse.json({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });

  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const dayOfWeek = typeof body.dayOfWeek === "number" && Number.isFinite(body.dayOfWeek) ? Math.round(body.dayOfWeek) : NaN;
  if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json({ ok: false, error: "INVALID_DAY" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  if (status !== "AVAILABLE" && status !== "ON_REQUEST") {
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
  }

  const normalized = normalizeRanges(body.ranges);
  if (!normalized.ok) {
    return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
  }

  // Replace-all semantics for that day+service.
  await (prisma as any).availabilityRule.deleteMany({ where: { sitterId: auth.sitterId, serviceType, dayOfWeek } });

  if (normalized.ranges.length) {
    await (prisma as any).availabilityRule.createMany({
      data: normalized.ranges.map((r) => ({
        sitterId: auth.sitterId,
        serviceType,
        dayOfWeek,
        startMin: r.startMin,
        endMin: r.endMin,
        status,
      })),
    });
  }

  const rows = await (prisma as any).availabilityRule.findMany({
    where: { sitterId: auth.sitterId, serviceType, dayOfWeek },
    orderBy: { startMin: "asc" },
    select: { id: true, dayOfWeek: true, startMin: true, endMin: true, status: true },
  });

  console.info("[api][sitters][me][availability-rules][PUT]", {
    sitterId: auth.sitterId,
    serviceType,
    dayOfWeek,
    ranges: normalized.ranges.length,
    status,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(
    { ok: true, sitterId: auth.sitterId, serviceType, dayOfWeek, rules: rows ?? [] },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
