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

type PutBody = {
  enabled?: unknown;
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

  const enabled = row?.enabled ?? true;

  return NextResponse.json(
    { ok: true, enabled },
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

  const keys = body && typeof body === "object" ? Object.keys(body as any) : [];
  if (keys.some((k) => k !== "enabled")) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
  if (enabled === undefined) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const data: Record<string, unknown> = { enabled };

  const updated = await (prisma as any).serviceConfig.upsert({
    where: { sitterId_serviceType: { sitterId: auth.sitterId, serviceType } },
    create: {
      sitterId: auth.sitterId,
      ...SERVICE_DEFAULTS[serviceType],
      enabled,
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
    { ok: true, enabled: updated.enabled },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
