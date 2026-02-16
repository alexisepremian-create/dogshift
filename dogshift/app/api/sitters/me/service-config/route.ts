import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSitterOwner } from "@/lib/auth/requireSitterOwner";
import { SERVICE_DEFAULTS, type ServiceType } from "@/lib/availability/slotEngine";
import { writeAvailabilityAuditLog } from "@/lib/availability/auditLog";

export const runtime = "nodejs";

function normalizeService(value: string): ServiceType | null {
  const v = value.trim().toUpperCase();
  if (v === "PROMENADE" || v === "DOGSITTING" || v === "PENSION") return v;
  return null;
}

function intInRange(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < min || r > max) return null;
  return r;
}

type PutBody = {
  enabled?: unknown;
  slotStepMin?: unknown;
  minDurationMin?: unknown;
  maxDurationMin?: unknown;
  leadTimeMin?: unknown;
  bufferBeforeMin?: unknown;
  bufferAfterMin?: unknown;
  overnightRequired?: unknown;
  checkInStartMin?: unknown;
  checkInEndMin?: unknown;
  checkOutStartMin?: unknown;
  checkOutEndMin?: unknown;
};

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const url = new URL(req.url);
  const serviceType = normalizeService(url.searchParams.get("service") ?? "");
  if (!serviceType) return NextResponse.json({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });

  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const row = await (prisma as any).serviceConfig.findUnique({
    where: { sitterId_serviceType: { sitterId: auth.sitterId, serviceType } },
  });

  const merged = row
    ? { ...SERVICE_DEFAULTS[serviceType], sitterId: auth.sitterId, ...row, serviceType }
    : { ...SERVICE_DEFAULTS[serviceType], sitterId: auth.sitterId };

  return NextResponse.json(
    { ok: true, sitterId: auth.sitterId, serviceType, config: merged },
    {
      status: 200,
      headers: { "cache-control": "no-store", "x-dogshift-duration": String(Date.now() - startedAt) },
    }
  );
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

  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;

  const slotStepMin = body.slotStepMin !== undefined ? intInRange(body.slotStepMin, 5, 240) : null;
  const minDurationMin = body.minDurationMin !== undefined ? intInRange(body.minDurationMin, 5, 24 * 60) : null;
  const maxDurationMin = body.maxDurationMin !== undefined ? intInRange(body.maxDurationMin, 5, 24 * 60) : null;
  const leadTimeMin = body.leadTimeMin !== undefined ? intInRange(body.leadTimeMin, 0, 14 * 24 * 60) : null;
  const bufferBeforeMin = body.bufferBeforeMin !== undefined ? intInRange(body.bufferBeforeMin, 0, 24 * 60) : null;
  const bufferAfterMin = body.bufferAfterMin !== undefined ? intInRange(body.bufferAfterMin, 0, 24 * 60) : null;

  if ((body.slotStepMin !== undefined && slotStepMin === null) || (body.minDurationMin !== undefined && minDurationMin === null)) {
    return NextResponse.json({ ok: false, error: "INVALID_CONFIG" }, { status: 400 });
  }
  if ((body.maxDurationMin !== undefined && maxDurationMin === null) || (body.leadTimeMin !== undefined && leadTimeMin === null)) {
    return NextResponse.json({ ok: false, error: "INVALID_CONFIG" }, { status: 400 });
  }
  if ((body.bufferBeforeMin !== undefined && bufferBeforeMin === null) || (body.bufferAfterMin !== undefined && bufferAfterMin === null)) {
    return NextResponse.json({ ok: false, error: "INVALID_CONFIG" }, { status: 400 });
  }

  const effectiveStep = slotStepMin ?? SERVICE_DEFAULTS[serviceType].slotStepMin;
  const effectiveMinDur = minDurationMin ?? SERVICE_DEFAULTS[serviceType].minDurationMin;
  const effectiveMaxDur = maxDurationMin ?? SERVICE_DEFAULTS[serviceType].maxDurationMin;
  if (effectiveMinDur % Math.max(1, effectiveStep) !== 0) {
    return NextResponse.json({ ok: false, error: "INVALID_CONFIG" }, { status: 400 });
  }
  if (effectiveMaxDur < effectiveMinDur) {
    return NextResponse.json({ ok: false, error: "INVALID_CONFIG" }, { status: 400 });
  }

  const overnightRequired = typeof body.overnightRequired === "boolean" ? body.overnightRequired : undefined;
  const checkInStartMin = body.checkInStartMin !== undefined ? intInRange(body.checkInStartMin, 0, 24 * 60) : null;
  const checkInEndMin = body.checkInEndMin !== undefined ? intInRange(body.checkInEndMin, 0, 24 * 60) : null;
  const checkOutStartMin = body.checkOutStartMin !== undefined ? intInRange(body.checkOutStartMin, 0, 24 * 60) : null;
  const checkOutEndMin = body.checkOutEndMin !== undefined ? intInRange(body.checkOutEndMin, 0, 24 * 60) : null;

  if (
    (body.checkInStartMin !== undefined && checkInStartMin === null) ||
    (body.checkInEndMin !== undefined && checkInEndMin === null) ||
    (body.checkOutStartMin !== undefined && checkOutStartMin === null) ||
    (body.checkOutEndMin !== undefined && checkOutEndMin === null)
  ) {
    return NextResponse.json({ ok: false, error: "INVALID_CONFIG" }, { status: 400 });
  }

  if (
    (checkInStartMin !== null && checkInEndMin !== null && checkInEndMin <= checkInStartMin) ||
    (checkOutStartMin !== null && checkOutEndMin !== null && checkOutEndMin <= checkOutStartMin)
  ) {
    return NextResponse.json({ ok: false, error: "INVALID_CONFIG" }, { status: 400 });
  }

  const data: Record<string, unknown> = {
    ...(enabled !== undefined ? { enabled } : null),
    ...(slotStepMin !== null ? { slotStepMin } : null),
    ...(minDurationMin !== null ? { minDurationMin } : null),
    ...(maxDurationMin !== null ? { maxDurationMin } : null),
    ...(leadTimeMin !== null ? { leadTimeMin } : null),
    ...(bufferBeforeMin !== null ? { bufferBeforeMin } : null),
    ...(bufferAfterMin !== null ? { bufferAfterMin } : null),
    ...(overnightRequired !== undefined ? { overnightRequired } : null),
    ...(checkInStartMin !== null ? { checkInStartMin } : null),
    ...(checkInEndMin !== null ? { checkInEndMin } : null),
    ...(checkOutStartMin !== null ? { checkOutStartMin } : null),
    ...(checkOutEndMin !== null ? { checkOutEndMin } : null),
  };

  const updated = await (prisma as any).serviceConfig.upsert({
    where: { sitterId_serviceType: { sitterId: auth.sitterId, serviceType } },
    create: {
      sitterId: auth.sitterId,
      serviceType,
      enabled: enabled ?? true,
      slotStepMin: effectiveStep,
      minDurationMin: effectiveMinDur,
      maxDurationMin: effectiveMaxDur,
      leadTimeMin: leadTimeMin ?? SERVICE_DEFAULTS[serviceType].leadTimeMin,
      bufferBeforeMin: bufferBeforeMin ?? SERVICE_DEFAULTS[serviceType].bufferBeforeMin,
      bufferAfterMin: bufferAfterMin ?? SERVICE_DEFAULTS[serviceType].bufferAfterMin,
      overnightRequired: overnightRequired ?? SERVICE_DEFAULTS[serviceType].overnightRequired,
      checkInStartMin: checkInStartMin,
      checkInEndMin: checkInEndMin,
      checkOutStartMin: checkOutStartMin,
      checkOutEndMin: checkOutEndMin,
    },
    update: data,
  });

  try {
    await writeAvailabilityAuditLog({
      sitterId: auth.sitterId,
      actorUserId: auth.dbUserId,
      action: "UPSERT_CONFIG",
      serviceType,
      payloadSummary: {
        keys: Object.keys(data),
      },
    });
  } catch {
    // best-effort
  }

  console.info("[api][sitters][me][service-config][PUT]", {
    sitterId: auth.sitterId,
    serviceType,
    keys: Object.keys(data),
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(
    { ok: true, sitterId: auth.sitterId, serviceType, config: updated },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
