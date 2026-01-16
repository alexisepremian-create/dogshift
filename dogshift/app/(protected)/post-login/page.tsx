import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { ensureDbUserFromClerkAuth } from "@/lib/auth/resolveDbUserId";
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

  const ensured = await ensureDbUserFromClerkAuth();
  if (!ensured?.id) {
    return <PageLoader label="Chargement…" />;
  }

  console.log("[post-login]", { userId, redirect: "/host" });
  void searchParams;
  redirect("/host");
}
