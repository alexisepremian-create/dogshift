"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import PageLoader from "@/components/ui/PageLoader";
import { SIGNOUT_HANDOFF_KEY } from "@/lib/auth/signoutHandoff";

export const dynamic = "force-dynamic";

// Hard cap: even if signOut hangs (network drop, blocked endpoint), the user
// must not stay stuck staring at the loader. 3 s is generous — signOut
// normally returns in <200 ms.
const FAILSAFE_MS = 3000;

/**
 * Aggressively wipe any leftover legacy Clerk cookies. The Auth.js session
 * cookie is cleared by `signOut()` itself; this is belt+suspenders for users
 * who land here mid-migration with stale Clerk cookies still in their browser.
 */
function clearLegacyAuthCookies() {
  try {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name.startsWith("__clerk") || name.startsWith("__session") || name === "__client_uat") {
        document.cookie = `${name}=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=/;domain=.dogshift.ch`;
        document.cookie = `${name}=;expires=Thu,01 Jan 1970 00:00:00 GMT;path=/;domain=dogshift.ch`;
      }
    });
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem("ds_auth_user");
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem("ds_auth_credentials");
  } catch {
    /* ignore */
  }
}

export default function SignOutPage() {
  const searchParams = useSearchParams();
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    // Where to land after sign-out. Defaults to /login if no redirect was
    // requested. We only accept same-origin relative paths to avoid being
    // turned into an open redirect.
    const rawRedirect = searchParams?.get("redirect") ?? "/login";
    const safeRedirect =
      rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
        ? rawRedirect
        : "/login";

    clearLegacyAuthCookies();

    function markHandoff() {
      // Tell the destination page (typically /login) that we just signed out.
      // Without this, if the SessionProvider on the next page mounts before
      // /api/auth/session reflects the cookie clear, the auto-redirect on
      // /login can bounce the user straight back to /post-login. The flag
      // lives in sessionStorage so it survives the hard navigation but is
      // tab-scoped (no cross-tab leakage).
      try {
        window.sessionStorage.setItem(SIGNOUT_HANDOFF_KEY, String(Date.now()));
      } catch {
        /* sessionStorage may be unavailable in private mode — ignore */
      }
    }

    const failsafe = window.setTimeout(() => {
      // signOut hung (unlikely). Force the redirect anyway — Auth.js may
      // still complete cookie clearing on the next request because
      // /api/auth/signout is idempotent.
      clearLegacyAuthCookies();
      markHandoff();
      window.location.replace(safeRedirect);
    }, FAILSAFE_MS);

    void (async () => {
      try {
        // signOut({ redirect: false }) returns once Auth.js has cleared its
        // JWT cookie via /api/auth/signout. We then do a HARD navigation
        // (not router.push) so the SessionProvider re-reads the now-empty
        // session from a fresh request — there's no point waiting on
        // useSession() to update because the cookie is gone server-side
        // and any client-state lag would just freeze the screen.
        await signOut({ redirect: false });
      } catch {
        /* swallow: even if signOut failed, we still try to redirect */
      }
      clearLegacyAuthCookies();
      markHandoff();
      window.clearTimeout(failsafe);
      window.location.replace(safeRedirect);
    })();

    return () => window.clearTimeout(failsafe);
  }, [searchParams]);

  return <PageLoader label="Déconnexion…" ready minDuration={300} persist static />;
}
