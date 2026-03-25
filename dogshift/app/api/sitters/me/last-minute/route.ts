import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSitterOwner } from "@/lib/auth/requireSitterOwner";
import { getUserPhone } from "@/lib/user/getUserPhone";

export const runtime = "nodejs";

type PutBody = { lastMinuteEnabled?: unknown };

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const [profile, user] = await Promise.all([
    prisma.sitterProfile.findUnique({
      where: { sitterId: auth.sitterId },
      select: { lastMinuteEnabled: true },
    }),
    prisma.user.findUnique({
      where: { id: auth.dbUserId },
      select: { id: true, phone: true, hostProfileJson: true },
    }),
  ]);

  const phonePresent = Boolean(
    getUserPhone({ userId: auth.dbUserId, phone: (user as any)?.phone, hostProfileJson: (user as any)?.hostProfileJson })
  );

  return NextResponse.json(
    { ok: true, lastMinuteEnabled: Boolean(profile?.lastMinuteEnabled), phonePresent },
    { status: 200, headers: { "cache-control": "no-store", "x-dogshift-duration": String(Date.now() - startedAt) } }
  );
}

export async function PUT(req: NextRequest) {
  const startedAt = Date.now();
  const auth = await requireSitterOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const keys = body && typeof body === "object" ? Object.keys(body as any) : [];
  if (keys.some((k) => k !== "lastMinuteEnabled")) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const lastMinuteEnabled = typeof body.lastMinuteEnabled === "boolean" ? body.lastMinuteEnabled : undefined;
  if (lastMinuteEnabled === undefined) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  if (lastMinuteEnabled) {
    const user = await prisma.user.findUnique({
      where: { id: auth.dbUserId },
      select: { id: true, phone: true, hostProfileJson: true },
    });
    const phone = getUserPhone({ userId: auth.dbUserId, phone: (user as any)?.phone, hostProfileJson: (user as any)?.hostProfileJson });
    if (!phone) {
      return NextResponse.json(
        {
          ok: false,
          error: "PHONE_REQUIRED",
          message: "Ajoutez un numéro de téléphone pour activer les réservations de dernière minute (notifications SMS).",
        },
        { status: 400 }
      );
    }
  }

  await prisma.sitterProfile.update({
    where: { sitterId: auth.sitterId },
    data: { lastMinuteEnabled },
    select: { id: true },
  });

  return NextResponse.json(
    { ok: true, lastMinuteEnabled },
    { status: 200, headers: { "cache-control": "no-store", "x-dogshift-duration": String(Date.now() - startedAt) } }
  );
}

