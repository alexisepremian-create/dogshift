import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { normalizeSitterLifecycleStatus, isActivatedStatus } from "@/lib/sitterContract";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const adminSession = await prisma.adminSession.findFirst({
    where: { clerkUserId, expiresAt: { gt: new Date() } },
  });
  if (!adminSession) {
    return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "MISSING_EMAIL_PARAM" }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: { email },
    select: {
      id: true,
      clerkUserId: true,
      email: true,
      name: true,
      role: true,
      sitterId: true,
      createdAt: true,
    },
  });

  const results = [];

  for (const user of users) {
    const sitterProfile = await (prisma as any).sitterProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        sitterId: true,
        lifecycleStatus: true,
        published: true,
        publishedAt: true,
        activatedAt: true,
        contractSignedAt: true,
        contractVersion: true,
      },
    });

    const normalizedLifecycle = sitterProfile
      ? normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, sitterProfile.published)
      : null;
    const activated = normalizedLifecycle != null && isActivatedStatus(normalizedLifecycle);

    const expectedRoute = activated ? "/host" : "/account";

    const anomalies: string[] = [];
    if (sitterProfile && !activated) {
      anomalies.push("SITTER_PROFILE_EXISTS_BUT_NOT_ACTIVATED");
    }
    if (sitterProfile && activated && user.role !== "SITTER") {
      anomalies.push("ACTIVATED_SITTER_BUT_ROLE_IS_OWNER");
    }
    if (user.role === "SITTER" && !sitterProfile) {
      anomalies.push("ROLE_SITTER_BUT_NO_PROFILE");
    }
    if (sitterProfile?.sitterId && user.sitterId !== sitterProfile.sitterId) {
      anomalies.push("SITTER_ID_MISMATCH_USER_VS_PROFILE");
    }
    if (!user.clerkUserId) {
      anomalies.push("NO_CLERK_USER_ID_LINKED");
    }

    results.push({
      user: {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        name: user.name,
        role: user.role,
        sitterId: user.sitterId,
        createdAt: user.createdAt,
      },
      sitterProfile: sitterProfile
        ? {
            id: sitterProfile.id,
            sitterId: sitterProfile.sitterId,
            rawLifecycleStatus: sitterProfile.lifecycleStatus,
            published: sitterProfile.published,
            publishedAt: sitterProfile.publishedAt,
            activatedAt: sitterProfile.activatedAt,
            contractSignedAt: sitterProfile.contractSignedAt,
            contractVersion: sitterProfile.contractVersion,
          }
        : null,
      normalizedLifecycle,
      activated,
      expectedRoute,
      anomalies,
    });
  }

  return NextResponse.json({
    email,
    userCount: users.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
