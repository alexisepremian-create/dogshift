import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSitterOwner } from "@/lib/auth/requireSitterOwner";
import type { ServiceType } from "@/lib/availability/slotEngine";
import { clampMinute, normalizeRanges } from "@/lib/availability/rangeValidation";
import { writeAvailabilityAuditLog } from "@/lib/availability/auditLog";

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
  rules?: unknown;
};

function normalizeRuleStatus(value: unknown) {
  const status = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (status !== "AVAILABLE" && status !== "ON_REQUEST") return null;
  return status as "AVAILABLE" | "ON_REQUEST";
}

function normalizeRulesWithStatus(raw: unknown) {
  if (!Array.isArray(raw)) return { ok: false as const, error: "INVALID_RANGES" as const };
  const out: Array<{ startMin: number; endMin: number; status: "AVAILABLE" | "ON_REQUEST" }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return { ok: false as const, error: "INVALID_RANGES" as const };
    const startMin = clampMinute((item as any).startMin);
    const endMin = clampMinute((item as any).endMin);
    const status = normalizeRuleStatus((item as any).status);
    if (startMin === null || endMin === null || endMin <= startMin || !status) return { ok: false as const, error: "INVALID_RANGES" as const };
    out.push({ startMin, endMin, status });
  }
  out.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  for (let i = 1; i < out.length; i++) {
    if (out[i].startMin < out[i - 1].endMin) return { ok: false as const, error: "INVALID_RANGES" as const };
  }
  return { ok: true as const, rules: out };
}

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

  const hasRulesArray = Array.isArray(body.rules);
  const normalizedRules = hasRulesArray ? normalizeRulesWithStatus(body.rules) : null;
  if (hasRulesArray && (!normalizedRules || !normalizedRules.ok)) {
    return NextResponse.json({ ok: false, error: "INVALID_RANGES" }, { status: 400 });
  }

  const normalizedLegacy = !hasRulesArray ? normalizeRanges(body.ranges) : null;
  const legacyStatus = !hasRulesArray ? normalizeRuleStatus(body.status) : null;
  if (!hasRulesArray) {
    if (!legacyStatus) return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
    if (!normalizedLegacy?.ok) return NextResponse.json({ ok: false, error: normalizedLegacy?.error ?? "INVALID_RANGES" }, { status: 400 });
  }

  // Replace-all semantics for that day+service.
  await (prisma as any).availabilityRule.deleteMany({ where: { sitterId: auth.sitterId, serviceType, dayOfWeek } });

  const toCreate = hasRulesArray
    ? (normalizedRules?.ok ? normalizedRules.rules : [])
    : normalizedLegacy && normalizedLegacy.ok
      ? normalizedLegacy.ranges.map((r) => ({ ...r, status: legacyStatus! }))
      : [];

  if (toCreate.length) {
    await (prisma as any).availabilityRule.createMany({
      data: toCreate.map((r) => ({
        sitterId: auth.sitterId,
        serviceType,
        dayOfWeek,
        startMin: r.startMin,
        endMin: r.endMin,
        status: r.status,
      })),
    });
  }

  try {
    await writeAvailabilityAuditLog({
      sitterId: auth.sitterId,
      actorUserId: auth.dbUserId,
      action: "REPLACE_RULES",
      serviceType,
      payloadSummary: {
        dayOfWeek,
        rules: toCreate.length,
      },
    });
  } catch {
    // best-effort
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
    ranges: toCreate.length,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(
    { ok: true, sitterId: auth.sitterId, serviceType, dayOfWeek, rules: rows ?? [] },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
