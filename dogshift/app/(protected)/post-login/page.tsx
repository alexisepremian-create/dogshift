import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { ensureDbUserFromClerkAuth } from "@/lib/auth/resolveDbUserId";

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
  if (!ensured) {
    redirect("/login");
  }

  const nextRaw = searchParams?.next;
  const next = typeof nextRaw === "string" ? nextRaw.trim() : "";
  if (next) {
    redirect(next);
  }
  redirect("/host");
}
