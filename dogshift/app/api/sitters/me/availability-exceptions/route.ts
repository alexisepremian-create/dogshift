import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSitterOwner } from "@/lib/auth/requireSitterOwner";
import type { ServiceType } from "@/lib/availability/slotEngine";
import { normalizeRanges } from "@/lib/availability/rangeValidation";

export const runtime = "nodejs";

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeService(value: string): ServiceType | null {
  const v = value.trim().toUpperCase();
  if (v === "PROMENADE" || v === "DOGSITTING" || v === "PENSION") return v;
  return null;
}

type PostBody = {
  serviceType?: unknown;
  date?: unknown;
  status?: unknown;
  ranges?: unknown;
};

type DeleteBody = {
  id?: unknown;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const serviceType = normalizeService(url.searchParams.get("service") ?? "");
  if (!serviceType) return NextResponse.json({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });

  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();

  const where: Record<string, unknown> = { sitterId: auth.sitterId, serviceType };
  if (from && isValidIsoDate(from)) (where as any).date = { ...(where as any).date, gte: from };
  if (to && isValidIsoDate(to)) (where as any).date = { ...(where as any).date, lte: to };

  const rows = await (prisma as any).availabilityException.findMany({
    where,
    orderBy: [{ date: "asc" }, { startMin: "asc" }],
    select: { id: true, date: true, startMin: true, endMin: true, status: true },
  });

  const exceptions = (rows ?? []).map((r: any) => ({
    id: r.id,
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
    startMin: r.startMin,
    endMin: r.endMin,
    status: r.status,
  }));

  return NextResponse.json({ ok: true, sitterId: auth.sitterId, serviceType, exceptions }, { status: 200, headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const serviceType = normalizeService(typeof body.serviceType === "string" ? body.serviceType : "");
  if (!serviceType) return NextResponse.json({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });

  const dateIso = typeof body.date === "string" ? body.date.trim() : "";
  if (!isValidIsoDate(dateIso)) return NextResponse.json({ ok: false, error: "INVALID_DATE" }, { status: 400 });

  const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  if (status !== "AVAILABLE" && status !== "ON_REQUEST" && status !== "UNAVAILABLE") {
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
  }

  const normalized = normalizeRanges(body.ranges);
  if (!normalized.ok) return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });

  const created = await (prisma as any).availabilityException.createMany({
    data: normalized.ranges.map((r) => ({
      sitterId: auth.sitterId,
      serviceType,
      date: new Date(`${dateIso}T00:00:00Z`),
      startMin: r.startMin,
      endMin: r.endMin,
      status,
    })),
  });

  console.info("[api][sitters][me][availability-exceptions][POST]", {
    sitterId: auth.sitterId,
    serviceType,
    date: dateIso,
    status,
    created: typeof created?.count === "number" ? created.count : null,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: NextRequest) {
  const startedAt = Date.now();
  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const found = await (prisma as any).availabilityException.findUnique({ where: { id }, select: { sitterId: true } });
  if (!found?.sitterId || found.sitterId !== auth.sitterId) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  await (prisma as any).availabilityException.delete({ where: { id } });

  console.info("[api][sitters][me][availability-exceptions][DELETE]", {
    sitterId: auth.sitterId,
    id,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });
}
