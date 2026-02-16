import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSitterOwner } from "@/lib/auth/requireSitterOwner";
import type { ServiceType } from "@/lib/availability/slotEngine";

export const runtime = "nodejs";

function normalizeService(value: string): ServiceType | null {
  const v = value.trim().toUpperCase();
  if (v === "PROMENADE" || v === "DOGSITTING" || v === "PENSION") return v;
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limitNum = typeof limitRaw === "string" && limitRaw.trim() ? Number(limitRaw) : 50;
  const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(200, Math.round(limitNum))) : 50;

  const serviceType = normalizeService(url.searchParams.get("service") ?? "");

  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const where: Record<string, unknown> = { sitterId: auth.sitterId };
  if (serviceType) (where as any).serviceType = serviceType;

  const rows = await (prisma as any).availabilityAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      action: true,
      serviceType: true,
      dateKey: true,
      payloadSummary: true,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      sitterId: auth.sitterId,
      items: rows ?? [],
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
