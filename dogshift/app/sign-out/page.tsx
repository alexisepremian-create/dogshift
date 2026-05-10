"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import PageLoader from "@/components/ui/PageLoader";

export const dynamic = "force-dynamic";

const REDIRECT_FALLBACK = "/login";
const FAILSAFE_MS = 5000;

function clearAllAuthState() {
  try { document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name.startsWith("__clerk") || name.startsWith("__session") || name === "__client_uat") {
      document.cookie = `${name}=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=/;domain=.dogshift.ch`;
      document.cookie = `${name}=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=/;domain=dogshift.ch`;
    }
  }); } catch { /* ignore */ }
  try { window.localStorage.removeItem("ds_auth_user"); } catch { /* ignore */ }
}

/**
 * /sign-out — clears Clerk session + auth cookies, then hard-redirects to /login.
 *
 * Strategy:
 *  1. Immediately clear known Clerk cookies and localStorage.
 *  2. Call clerk.signOut() to properly revoke the session server-side.
 *  3. Hard-redirect to /login (never relies on Clerk's internal redirect).
 *  4. A 5s failsafe guarantees redirect even if signOut() hangs.
 */
export default function SignOutPage() {
  const clerk = useClerk();
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    clearAllAuthState();

    const redirect = () => {
      window.location.replace(REDIRECT_FALLBACK);
    };

    const failsafe = window.setTimeout(redirect, FAILSAFE_MS);

    void (async () => {
      try {
        await clerk.signOut();
      } catch {
        // Session may already be expired/deleted — cookies are cleared above.
      }
      clearAllAuthState();
      window.clearTimeout(failsafe);
      redirect();
    })();

    return () => window.clearTimeout(failsafe);
  }, [clerk]);

  return <PageLoader label="Déconnexion…" ready minDuration={300} persist static />;
}
