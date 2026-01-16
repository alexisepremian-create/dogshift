import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DS_DEBUG_ROUTING === "1") {
    console.log("[POST_LOGIN_RENDER]", { searchParams });
  }

  const { userId } = await auth();
  if (!userId) {
    const h = await headers();
    console.warn("[auth][post-login] clerk signed-out", {
      clerkAuthReason: h.get("x-clerk-auth-reason"),
      clerkAudStatus: h.get("x-clerk-aud-status"),
      clerkRequestId: h.get("x-clerk-request-id"),
      host: h.get("host"),
      forwardedProto: h.get("x-forwarded-proto"),
      forwardedHost: h.get("x-forwarded-host"),
      forwardedFor: h.get("x-forwarded-for"),
    });
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
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DS_DEBUG_ROUTING === "1") {
      console.log("[POST_LOGIN_REDIRECT]", { to: next });
    }
    redirect(next);
  }

  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DS_DEBUG_ROUTING === "1") {
    console.log("[POST_LOGIN_REDIRECT]", { to: "/host" });
  }
  redirect("/host");
}
