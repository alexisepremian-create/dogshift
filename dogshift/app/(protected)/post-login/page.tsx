import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { ensureDbUserFromClerkAuth } from "@/lib/auth/resolveDbUserId";
import { prisma } from "@/lib/prisma";
import PageLoader from "@/components/ui/PageLoader";

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  let dbUserId: string;
  let hasSitterProfile: boolean;
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
    const sitterProfile = await prisma.sitterProfile.findUnique({ where: { userId: dbUserId }, select: { id: true } });
    hasSitterProfile = Boolean(sitterProfile?.id);
    decidedRedirect = hasSitterProfile ? "/host" : "/account";
  } catch (e) {
    console.log("[post-login] db check failed", { userId });
    return <PageLoader label="Chargement…" />;
  }

  console.log("[post-login]", { userId, dbUserId, hasSitterProfile, decidedRedirect });

  const nextRaw = searchParams?.next;
  const next = typeof nextRaw === "string" ? nextRaw.trim() : "";
  if (hasSitterProfile && next) {
    redirect(next);
  }
  redirect(decidedRedirect);
}
