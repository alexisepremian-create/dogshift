"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import PageLoader from "@/components/ui/PageLoader";

export const dynamic = "force-dynamic";

const FAILSAFE_MS = 6000;

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
  const { status } = useSession();
  const doneRef = useRef(false);
  const [signOutDone, setSignOutDone] = useState(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    clearLegacyAuthCookies();

    const failsafe = window.setTimeout(() => {
      clearLegacyAuthCookies();
      window.location.replace("/login?force=1");
    }, FAILSAFE_MS);

    void (async () => {
      try {
        // signOut({ redirect: false }) returns once Auth.js has cleared its
        // session cookie. We then do a hard navigation so the SessionProvider
        // re-reads the (now-empty) session.
        await signOut({ redirect: false });
      } catch {
        /* ignore */
      }
      clearLegacyAuthCookies();
      setSignOutDone(true);
    })();

    return () => window.clearTimeout(failsafe);
  }, []);

  useEffect(() => {
    if (!signOutDone) return;
    if (status === "loading") return;
    if (status === "authenticated") {
      clearLegacyAuthCookies();
      return;
    }
    window.location.replace("/login");
  }, [signOutDone, status]);

  return <PageLoader label="Déconnexion…" ready minDuration={300} persist static />;
}
