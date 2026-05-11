import { NextResponse } from "next/server";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";

import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  try {
    const __authed = await getAuthedDbUser();
    const userId = __authed?.id ?? null;
    if (!__authed) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- clerkUserId not in generated Prisma types
    const existingUser = await (prisma as any).user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (existingUser?.id) {
      const sitterProfile = await prisma.sitterProfile.findUnique({
        where: { userId: existingUser.id },
        select: { id: true },
      });

      if (!sitterProfile) {
        return NextResponse.json(
          { ok: false, error: "SITTER_PROFILE_REQUIRED", message: "Créez d’abord votre profil dogsitter." },
          { status: 403 },
        );
      }

      const now = new Date();
      console.info("[api][host][accept-terms] before", { clerkUserId: userId, dbUserId: existingUser.id, now: now.toISOString() });
      await prisma.sitterProfile.update({
        where: { userId: existingUser.id },
        data: { termsAcceptedAt: now, termsVersion: CURRENT_TERMS_VERSION },
        select: { id: true },
      });

      console.info("[api][host][accept-terms] after", {
        clerkUserId: userId,
        dbUserId: existingUser.id,
        termsVersion: CURRENT_TERMS_VERSION,
        termsAcceptedAt: now.toISOString(),
      });

      void logAudit({ action: "consent.host_terms", actorType: "user", actorId: userId, targetId: existingUser.id, metadata: { termsVersion: CURRENT_TERMS_VERSION } });
      return NextResponse.json({ ok: true, termsVersion: CURRENT_TERMS_VERSION }, { status: 200 });
    }

    // (() => null) /* currentUser removed */() removed — use __authed.email / __authed.name
    const primaryEmail = __authed?.email ?? "";
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ensured = (__authed ? { id: __authed.id, role: __authed.role, sitterId: __authed.sitterId, created: false } : null);
    if (!ensured) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const sitterProfile = await prisma.sitterProfile.findUnique({
      where: { userId: __authed.id },
      select: { id: true },
    });
    if (!sitterProfile) {
      return NextResponse.json(
        { ok: false, error: "SITTER_PROFILE_REQUIRED", message: "Créez d’abord votre profil dogsitter." },
        { status: 403 },
      );
    }

    const now = new Date();
    console.info("[api][host][accept-terms] before", { clerkUserId: userId, dbUserId: __authed.id, now: now.toISOString() });
    await prisma.sitterProfile.update({
      where: { userId: __authed.id },
      data: { termsAcceptedAt: now, termsVersion: CURRENT_TERMS_VERSION },
      select: { id: true },
    });

    console.info("[api][host][accept-terms] after", {
      clerkUserId: userId,
      dbUserId: __authed.id,
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: now.toISOString(),
    });

    void logAudit({ action: "consent.host_terms", actorType: "user", actorId: userId, targetId: __authed.id, metadata: { termsVersion: CURRENT_TERMS_VERSION } });
    return NextResponse.json({ ok: true, termsVersion: CURRENT_TERMS_VERSION }, { status: 200 });
  } catch (err) {
    console.error("[api][host][accept-terms] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
