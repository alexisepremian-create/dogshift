import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";

import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!email) {
    console.warn("[auth][post-login] missing primary email", { clerkUserId: userId });
    redirect("/login");
  }

  const name = typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null;

  const ensured = await ensureDbUserByClerkUserId({
    clerkUserId: userId,
    email,
    name,
  });

  if (!ensured) {
    console.error("[auth][post-login] db user ensure failed", { clerkUserId: userId });
    redirect("/login");
  }

  if (ensured.created) {
    console.info("[auth][post-login] db user created", { clerkUserId: userId, dbUserId: ensured.id });
    redirect("/onboarding");
  }

  const nextRaw = searchParams?.next;
  const next = typeof nextRaw === "string" ? nextRaw.trim() : "";
  if (next) {
    redirect(next);
  }

  redirect("/dashboard");
}
