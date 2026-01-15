import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const inviteId = req.cookies.get("dogsitter_invite_id")?.value;
    if (!inviteId) {
      return NextResponse.json({ ok: false, error: "INVITE_REQUIRED" }, { status: 403 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId: userId,
      email: primaryEmail,
      name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
    });

    if (!ensured) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const now = new Date();
    const invite = await prisma.inviteCode.findUnique({
      where: { id: inviteId },
      select: { id: true, type: true, usedAt: true, expiresAt: true },
    });

    if (!invite) {
      return NextResponse.json({ ok: false, error: "INVITE_INVALID" }, { status: 403 });
    }

    if (invite.expiresAt && invite.expiresAt instanceof Date && invite.expiresAt.getTime() <= now.getTime()) {
      return NextResponse.json({ ok: false, error: "INVITE_EXPIRED" }, { status: 403 });
    }

    if (invite.type === "single_use" && invite.usedAt) {
      return NextResponse.json({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 403 });
    }

    const payload = body as Record<string, unknown>;
    const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
    const city = typeof payload.city === "string" ? payload.city.trim() : "";
    const bio = typeof payload.bio === "string" ? payload.bio.trim() : "";
    const avatarDataUrl = typeof payload.avatarDataUrl === "string" ? payload.avatarDataUrl : null;
    const services = typeof payload.services === "object" && payload.services ? payload.services : null;
    const hourlyRate = typeof payload.hourlyRate === "number" ? payload.hourlyRate : null;
    const pricePerDay = typeof payload.pricePerDay === "number" ? payload.pricePerDay : null;

    const existingUser = await prisma.user.findUnique({ where: { id: ensured.id }, select: { sitterId: true } });
    const sitterId = (existingUser?.sitterId && existingUser.sitterId.trim())
      ? existingUser.sitterId.trim()
      : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await prisma.$transaction(async (tx) => {
      if (invite.type === "single_use") {
        const updated = await tx.inviteCode.updateMany({
          where: { id: invite.id, usedAt: null },
          data: { usedAt: now },
        });
        if (updated.count !== 1) {
          throw new Error("INVITE_ALREADY_USED");
        }
      }

      await tx.user.update({
        where: { id: ensured.id },
        data: { role: "SITTER", sitterId } as unknown as { role: "SITTER"; sitterId: string },
        select: { id: true },
      });

      await tx.sitterProfile.upsert({
        where: { userId: ensured.id },
        create: {
          userId: ensured.id,
          sitterId,
          published: false,
          publishedAt: null,
          profileCompletion: 0,
          displayName: firstName || null,
          city: city || null,
          bio: bio || null,
          avatarUrl: avatarDataUrl,
          services: services as Prisma.InputJsonValue,
          pricing: { hourlyRate, pricePerDay } as Prisma.InputJsonValue,
        },
        update: {
          sitterId,
          profileCompletion: 0,
          displayName: firstName || null,
          city: city || null,
          bio: bio || null,
          avatarUrl: avatarDataUrl,
          services: services as Prisma.InputJsonValue,
          pricing: { hourlyRate, pricePerDay } as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
    });

    return NextResponse.json({ ok: true, sitterId }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "INVITE_ALREADY_USED") {
      return NextResponse.json({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 403 });
    }
    console.error("[api][become-sitter][apply] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
