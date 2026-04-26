import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { ensureDbUserFromClerkAuth } from "@/lib/auth/resolveDbUserId";
import { prisma } from "@/lib/prisma";
import { isActivatedStatus, normalizeSitterLifecycleStatus } from "@/lib/sitterContract";

// Lifecycle statuses that require the sitter to complete activation via code.
const CONTRACT_SIGNED_STATUSES = new Set(["contract_signed"]);


export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ redirect: "/login" }, { status: 401 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic field (clerkUserId not in generated types).
    let dbUser = await (prisma as any).user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, role: true, email: true, sitterId: true },
    });

    if (!dbUser?.id) {
      const ensured = await ensureDbUserFromClerkAuth();
      if (!ensured?.id) {
        console.warn("[resolve-redirect] unable to ensure DB user", { clerkUserId: userId });
        return NextResponse.json({ redirect: "/login?force=1" });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic field.
      dbUser = await (prisma as any).user.findUnique({
        where: { id: ensured.id },
        select: { id: true, role: true, email: true, sitterId: true },
      });
    }

    const sitterProfile = await prisma.sitterProfile.findUnique({
      where: { userId: dbUser.id },
      select: { id: true, lifecycleStatus: true, published: true },
    });

    const lifecycleStatus = sitterProfile
      ? normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, sitterProfile.published)
      : null;

    const isSitter =
      (lifecycleStatus && isActivatedStatus(lifecycleStatus)) ||
      (dbUser.role === "SITTER" && !!dbUser.sitterId);

    const needsActivation = lifecycleStatus !== null && CONTRACT_SIGNED_STATUSES.has(lifecycleStatus);

    const redirect = isSitter ? "/host" : needsActivation ? "/become-sitter/activate" : "/account";

    return NextResponse.json({ redirect });
  } catch (e) {
    console.error("[resolve-redirect] failed", {
      clerkUserId: userId,
      error: e instanceof Error ? { name: e.name, message: e.message } : e,
    });
    return NextResponse.json({ redirect: "/login?force=1" });
  }
}
