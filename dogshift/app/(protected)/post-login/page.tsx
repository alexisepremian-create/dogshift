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
    let dbUser = await (prisma as any).user.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
    if (!dbUser?.id) {
      const ensured = await ensureDbUserFromClerkAuth();
      if (!ensured?.id) {
        return <PageLoader label="Chargement…" />;
      }
      dbUser = { id: ensured.id };
    }

    dbUserId = dbUser.id;
    const sitterProfile = await prisma.sitterProfile.findUnique({ where: { userId: dbUserId }, select: { id: true, lifecycleStatus: true, published: true } });
    hasSitterProfile = Boolean(sitterProfile?.id);
    sitterLifecycleStatus = sitterProfile ? normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, sitterProfile.published) : null;
    decidedRedirect = sitterLifecycleStatus && isActivatedStatus(sitterLifecycleStatus) ? "/host" : "/account";
  } catch (e) {
    console.log("[post-login] db check failed", { userId });
    return <PageLoader label="Chargement…" />;
  }

  console.log("[post-login]", { userId, dbUserId, hasSitterProfile, sitterLifecycleStatus, decidedRedirect });

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextRaw = resolvedSearchParams?.next;
  const next = typeof nextRaw === "string" ? nextRaw.trim() : "";
  if (decidedRedirect === "/host" && next) {
    redirect(next);
  }
  redirect(decidedRedirect);
}
