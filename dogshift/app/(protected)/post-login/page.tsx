import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { ensureDbUserFromClerkAuth } from "@/lib/auth/resolveDbUserId";
import { prisma } from "@/lib/prisma";
import { isActivatedStatus, normalizeSitterLifecycleStatus, type SitterLifecycleStatus } from "@/lib/sitterContract";
import PageLoader from "@/components/ui/PageLoader";

type PostLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PostLoginPage({
  searchParams,
}: PostLoginPageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  let dbUserId: string;
  let hasSitterProfile: boolean;
  let sitterLifecycleStatus: SitterLifecycleStatus | null;
  let decidedRedirect: "/host" | "/account";

  try {
    let dbUser = await (prisma as any).user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, role: true, email: true, sitterId: true },
    });
    if (!dbUser?.id) {
      const ensured = await ensureDbUserFromClerkAuth();
      if (!ensured?.id) {
        console.warn("[role-resolution][post-login] unable to ensure DB user", { clerkUserId: userId });
        return <PageLoader label="Chargement…" />;
      }
      dbUser = await (prisma as any).user.findUnique({
        where: { id: ensured.id },
        select: { id: true, role: true, email: true, sitterId: true },
      });
    }

    dbUserId = dbUser.id;
    const sitterProfile = await prisma.sitterProfile.findUnique({
      where: { userId: dbUserId },
      select: { id: true, lifecycleStatus: true, published: true, sitterId: true },
    });
    hasSitterProfile = Boolean(sitterProfile?.id);
    sitterLifecycleStatus = sitterProfile ? normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, sitterProfile.published) : null;
    decidedRedirect = sitterLifecycleStatus && isActivatedStatus(sitterLifecycleStatus) ? "/host" : "/account";

    console.info("[role-resolution][post-login]", {
      clerkUserId: userId,
      dbUserId,
      dbEmail: dbUser.email ?? null,
      dbRole: dbUser.role ?? null,
      dbSitterId: dbUser.sitterId ?? null,
      hasSitterProfile,
      sitterProfileId: sitterProfile?.id ?? null,
      rawLifecycleStatus: sitterProfile?.lifecycleStatus ?? null,
      published: sitterProfile?.published ?? null,
      normalizedLifecycleStatus: sitterLifecycleStatus,
      decidedRedirect,
    });
  } catch (e) {
    console.error("[role-resolution][post-login] db check failed", {
      clerkUserId: userId,
      error: e instanceof Error ? { name: e.name, message: e.message } : e,
    });
    return <PageLoader label="Chargement…" />;
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextRaw = resolvedSearchParams?.next;
  const next = typeof nextRaw === "string" ? nextRaw.trim() : "";
  if (decidedRedirect === "/host" && next) {
    redirect(next);
  }
  redirect(decidedRedirect);
}
