"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import PageLoader from "@/components/ui/PageLoader";
import { withPublicOrigin } from "@/lib/url/publicOrigin";

// Always run this page dynamically — it's auth-critical and must never serve a
// stale build-time shell that holds the user on a blank page.
export const dynamic = "force-dynamic";

const REDIRECT_FALLBACK = "/login?force=1";

/**
 * /sign-out — clears the Clerk session and ALWAYS lands the user on /login.
 *
 * Failure modes that have hit us in the past:
 *  - Clerk SDK takes 2-3s to initialize on slow mobile networks → the user
 *    sees a blank page while we wait on `useAuth().isLoaded`.
 *  - `clerk.signOut({ redirectUrl })` hangs on a network blip → the user
 *    stays on /sign-out forever.
 *
 * This implementation:
 *  1. Fires `clerk.signOut()` as soon as possible (no min-duration).
 *  2. Hard-redirects to /login on the canonical origin within ~600ms,
 *     regardless of whether `signOut()` resolved. The Clerk session
 *     cookie is cleared by the SDK synchronously enough; the redirect
 *     hits /login?force=1 which would handle the "still signed in" case
 *     by showing the relogin banner.
 *  3. A 4 s failsafe guarantees a redirect even if everything stalls.
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

    const failsafe = window.setTimeout(goNow, 4000);

    void (async () => {
      try {
        await Promise.race([
          Promise.resolve(clerk.signOut({ redirectUrl: target })),
          new Promise<void>((resolve) => window.setTimeout(resolve, 800)),
        ]);
      } catch {
        /* expired / deleted session */
      }
      window.clearTimeout(failsafe);
      goNow();
    })();

    return () => window.clearTimeout(failsafe);
  }, [clerk]);

  return <PageLoader label="Déconnexion…" ready minDuration={300} persist static />;
}
