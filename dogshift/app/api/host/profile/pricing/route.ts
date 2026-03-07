import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

type PutBody = {
  pricing?: unknown;
};

function normalizePricing(raw: unknown) {
  if (!raw || typeof raw !== "object") return { ok: false as const, error: "INVALID_PRICING" as const };
  const obj = raw as Record<string, unknown>;

  const allowed = new Set(["Promenade", "Garde", "Pension"]);
  const out: Record<string, number> = {};
  const missingOrInvalid: string[] = [];

  for (const [k, v] of Object.entries(obj)) {
    if (!allowed.has(k)) continue;
    if (v === null || v === "" || v === undefined) {
      missingOrInvalid.push(k);
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) {
      missingOrInvalid.push(k);
      continue;
    }
    const n = Math.round(v * 100) / 100;
    if (n <= 0) {
      missingOrInvalid.push(k);
      continue;
    }
    out[k] = n;
  }

  return { ok: true as const, pricing: out, missingOrInvalid };
}

function serviceTypeForPricingKey(key: string) {
  if (key === "Promenade") return "PROMENADE";
  if (key === "Garde") return "DOGSITTING";
  if (key === "Pension") return "PENSION";
  return null;
}

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!primaryEmail) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId: userId,
      email: primaryEmail,
      name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
    });
    if (!ensured) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const uid = ensured.id;

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { sitterId: true },
    });
    const sitterId = typeof (user as any)?.sitterId === "string" ? String((user as any).sitterId).trim() : "";
    if (!sitterId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    let body: PutBody;
    try {
      body = (await req.json()) as PutBody;
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const normalized = normalizePricing(body.pricing);
    if (!normalized.ok) return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });

    const sitterProfile = await prisma.sitterProfile.findUnique({
      where: { userId: uid },
      select: { id: true, pricing: true, services: true },
    });

    if (!sitterProfile) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const pricing = normalized.pricing as Prisma.InputJsonValue;

    const updated = await prisma.sitterProfile.update({
      where: { userId: uid },
      data: { pricing },
      select: { pricing: true },
    });

    const userRow = await prisma.user.findUnique({
      where: { id: uid },
      select: { hostProfileJson: true },
    });

    const hostProfileJsonRaw = typeof userRow?.hostProfileJson === "string" ? userRow.hostProfileJson : null;
    if (hostProfileJsonRaw) {
      try {
        const parsed = JSON.parse(hostProfileJsonRaw) as Record<string, unknown>;
        const nextHostProfileJson = JSON.stringify({
          ...parsed,
          pricing: normalized.pricing,
          updatedAt: new Date().toISOString(),
        });
        await prisma.user.update({
          where: { id: uid },
          data: { hostProfileJson: nextHostProfileJson } as unknown as Record<string, unknown>,
        });
      } catch {
        // ignore malformed legacy hostProfileJson
      }
    }

    const toDisable = (normalized.missingOrInvalid ?? [])
      .map((k) => serviceTypeForPricingKey(k))
      .filter((v): v is "PROMENADE" | "DOGSITTING" | "PENSION" => v === "PROMENADE" || v === "DOGSITTING" || v === "PENSION");

    if (toDisable.length) {
      await Promise.all(
        toDisable.map((serviceType) =>
          (prisma as any).serviceConfig.upsert({
            where: { sitterId_serviceType: { sitterId, serviceType } },
            create: {
              sitterId,
              serviceType,
              enabled: false,
            },
            update: { enabled: false },
          })
        )
      );
    }

    return NextResponse.json(
      { ok: true, pricing: updated.pricing, disabledServices: toDisable },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("[api][host][profile][pricing][PUT] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
