"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import PageLoader from "@/components/ui/PageLoader";
import { withPublicOrigin } from "@/lib/url/publicOrigin";

export const dynamic = "force-dynamic";

const REDIRECT_FALLBACK = "/login?force=1";
const FAILSAFE_MS = 6000;

/**
 * /sign-out — clears the Clerk session then redirects to /login.
 *
 * Waits for clerk.signOut() to actually complete before redirecting so
 * the session cookie is properly invalidated. A 6 s failsafe guarantees
 * a redirect even if the Clerk API hangs.
 */
export default function SignOutPage() {
  const clerk = useClerk();
  const startedRef = useRef(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const search = typeof window !== "undefined" ? window.location.search : "";
    const rawRedirect = new URLSearchParams(search).get("redirect")?.trim() || REDIRECT_FALLBACK;
    const target = withPublicOrigin(rawRedirect) || REDIRECT_FALLBACK;

    const goNow = () => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      try { window.localStorage.removeItem("ds_auth_user"); } catch { /* ignore */ }
      window.location.replace(target);
    };

    const failsafe = window.setTimeout(goNow, FAILSAFE_MS);

    void (async () => {
      try {
        await clerk.signOut();
      } catch {
        /* expired / already-deleted session — cookie is gone either way */
      }
      window.clearTimeout(failsafe);
      goNow();
    })();

    return () => window.clearTimeout(failsafe);
  }, [clerk]);

  return <PageLoader label="Déconnexion…" ready minDuration={300} persist static />;
}
