/**
 * Legacy `/auth/google` callback page.
 *
 * Auth.js v5 handles the Google OAuth callback at `/api/auth/callback/google`
 * automatically. This page exists only because the old Clerk flow stored the
 * post-OAuth redirect path in sessionStorage and routed through here first.
 *
 * Behaviour now: clear the leftover sessionStorage marker, then redirect to
 * /post-login (which decides /host vs /account based on role).
 *
 * Once we're confident no in-flight Clerk OAuth callbacks are hitting this
 * URL anymore, this file can be deleted (PR 3 cleanup).
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import PageLoader from "@/components/ui/PageLoader";

export const dynamic = "force-dynamic";

const OAUTH_AFTER_KEY = "ds_oauth_after";

function readStoredRedirectPath(): string {
  if (typeof window === "undefined") return "/post-login";
  try {
    const raw = sessionStorage.getItem(OAUTH_AFTER_KEY)?.trim();
    sessionStorage.removeItem(OAUTH_AFTER_KEY);
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  } catch {
    /* ignore */
  }
  return "/post-login";
}

export default function AuthGooglePage() {
  const router = useRouter();

  useEffect(() => {
    const target = readStoredRedirectPath();
    router.replace(target);
  }, [router]);

  return <PageLoader label="Connexion…" persist />;
}
