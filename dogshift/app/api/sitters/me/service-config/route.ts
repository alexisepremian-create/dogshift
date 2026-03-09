import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSitterOwner } from "@/lib/auth/requireSitterOwner";
import { SERVICE_DEFAULTS, type ServiceType } from "@/lib/availability/slotEngine";
import { writeAvailabilityAuditLog } from "@/lib/availability/auditLog";
import { buildEffectiveSitterCompletionProfile, computeSitterProfileCompletion } from "@/lib/sitterCompletion";

export const runtime = "nodejs";

function normalizeService(value: string): ServiceType | null {
  const v = value.trim().toUpperCase();
  if (v === "PROMENADE" || v === "DOGSITTING" || v === "PENSION") return v;
  return null;
}

function pricingKeyForService(serviceType: ServiceType) {
  if (serviceType === "PROMENADE") return "Promenade";
  if (serviceType === "DOGSITTING") return "Garde";
  return "Pension";
}

async function hasValidPricing(sitterId: string, serviceType: ServiceType) {
  const profile = await prisma.sitterProfile.findUnique({
    where: { sitterId },
    select: { pricing: true },
  });
  const pricing = (profile?.pricing && typeof profile.pricing === "object" ? (profile.pricing as any) : null) as Record<string, unknown> | null;
  const key = pricingKeyForService(serviceType);
  const v = pricing ? pricing[key] : null;
  return typeof v === "number" && Number.isFinite(v) && v > 0;
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

  if (enabled) {
    const ok = await hasValidPricing(auth.sitterId, serviceType);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "PRICING_REQUIRED" }, { status: 400 });
    }
  }

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

  const [userRow, sitterProfile, serviceConfigs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.dbUserId },
      select: { hostProfileJson: true },
    }),
    prisma.sitterProfile.findUnique({
      where: { userId: auth.dbUserId },
      select: { pricing: true },
    }),
    (prisma as any).serviceConfig.findMany({
      where: { sitterId: auth.sitterId },
      select: { serviceType: true, enabled: true },
    }),
  ]);

  let hostProfile: unknown = null;
  const hostProfileJsonRaw = typeof userRow?.hostProfileJson === "string" ? userRow.hostProfileJson : null;
  if (hostProfileJsonRaw) {
    try {
      hostProfile = JSON.parse(hostProfileJsonRaw) as unknown;
    } catch {
      hostProfile = null;
    }
  }

  const enabledServiceTypes = Array.isArray(serviceConfigs)
    ? serviceConfigs.filter((row) => row && row.enabled === true).map((row) => String(row.serviceType ?? ""))
    : [];
  const completionProfile = buildEffectiveSitterCompletionProfile({
    profile: hostProfile,
    enabledServiceTypes,
    persistedPricing: sitterProfile?.pricing,
  });
  const completion = computeSitterProfileCompletion(completionProfile);

  await prisma.sitterProfile.update({
    where: { userId: auth.dbUserId },
    data: { profileCompletion: completion },
    select: { id: true },
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
    { ok: true, enabled: updated.enabled, profileCompletion: completion },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
