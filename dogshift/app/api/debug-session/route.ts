import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";

import { prisma } from "@/lib/prisma";
import { normalizeSitterLifecycleStatus, isActivatedStatus } from "@/lib/sitterContract";
import { getRequestAdminAccess } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const adminAccess = await getRequestAdminAccess(req);
  if (!adminAccess.isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN", hint: "Admin access required" }, { status: 403 });
  }

  const __authed = await getAuthedDbUser();
    const clerkUserId = __authed?.id ?? null;
  if (!clerkUserId) {
    return NextResponse.json({ error: "NOT_SIGNED_IN", hint: "Open this URL while signed in" }, { status: 401 });
  }

  // (() => null) /* currentUser removed */() removed — use __authed.email / __authed.name
  const clerkEmail = __authed?.email ?? null;
  const clerkName = __authed?.name ?? null;

  const userByClerk = await (prisma as any).user.findUnique({
    where: { clerkUserId },
    select: { id: true, email: true, role: true, sitterId: true, createdAt: true },
  });

  const userByEmail = clerkEmail
    ? await prisma.user.findUnique({
        where: { email: clerkEmail.trim().toLowerCase() },
        select: { id: true, clerkUserId: true, email: true, role: true, sitterId: true, createdAt: true },
      })
    : null;

  const dbUser = userByClerk ?? userByEmail;
  const dbUserId = dbUser?.id ?? null;

  let sitterProfile = null;
  if (dbUserId) {
    sitterProfile = await (prisma as any).sitterProfile.findUnique({
      where: { userId: dbUserId },
      select: {
        id: true,
        sitterId: true,
        lifecycleStatus: true,
        published: true,
        publishedAt: true,
        verificationStatus: true,
        activatedAt: true,
        contractSignedAt: true,
      },
    });
  }

  const normalizedLifecycle = sitterProfile
    ? normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, sitterProfile.published)
    : null;
  const activated = normalizedLifecycle != null && isActivatedStatus(normalizedLifecycle);
  const decidedRoute = activated ? "/host" : "/account";

  const mismatch = userByClerk && userByEmail && userByClerk.id !== (userByEmail as any).id;
  const clerkNotLinked = !userByClerk && userByEmail;

  const anomalies: string[] = [];
  if (mismatch) anomalies.push("CLERK_AND_EMAIL_RESOLVE_TO_DIFFERENT_USERS");
  if (clerkNotLinked) anomalies.push("CLERK_NOT_LINKED_TO_DB_USER_BUT_EMAIL_MATCH_EXISTS");
  if (!dbUser) anomalies.push("NO_DB_USER_FOUND");
  if (dbUser && !sitterProfile) anomalies.push("NO_SITTER_PROFILE");
  if (sitterProfile && !activated) anomalies.push("SITTER_PROFILE_EXISTS_BUT_NOT_ACTIVATED");
  if (sitterProfile && activated && dbUser?.role !== "SITTER") anomalies.push("ACTIVATED_BUT_ROLE_NOT_SITTER");
  if (dbUser?.sitterId && sitterProfile?.sitterId && dbUser.sitterId !== sitterProfile.sitterId) anomalies.push("SITTER_ID_MISMATCH");

  return NextResponse.json({
    clerk: { clerkUserId, clerkEmail, clerkName },
    userByClerk: userByClerk ? { id: userByClerk.id, email: userByClerk.email, role: userByClerk.role, sitterId: userByClerk.sitterId, createdAt: userByClerk.createdAt } : null,
    userByEmail: userByEmail ? { id: (userByEmail as any).id, clerkUserId: (userByEmail as any).clerkUserId, email: (userByEmail as any).email, role: (userByEmail as any).role, sitterId: (userByEmail as any).sitterId, createdAt: (userByEmail as any).createdAt } : null,
    resolvedDbUser: dbUser ? { id: dbUser.id, email: dbUser.email, role: dbUser.role, sitterId: dbUser.sitterId } : null,
    sitterProfile: sitterProfile ? {
      id: sitterProfile.id,
      sitterId: sitterProfile.sitterId,
      lifecycleStatusRaw: sitterProfile.lifecycleStatus,
      published: sitterProfile.published,
      publishedAt: sitterProfile.publishedAt,
      verificationStatus: sitterProfile.verificationStatus ?? null,
      activatedAt: sitterProfile.activatedAt,
      contractSignedAt: sitterProfile.contractSignedAt,
    } : null,
    resolution: { normalizedLifecycle, activated, decidedRoute },
    anomalies,
    timestamp: new Date().toISOString(),
  });
}
