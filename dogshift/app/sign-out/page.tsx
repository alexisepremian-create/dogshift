"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import PageLoader from "@/components/ui/PageLoader";

export const dynamic = "force-dynamic";

const FAILSAFE_MS = 6000;

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
  try { window.localStorage.removeItem("ds_auth_credentials"); } catch { /* ignore */ }
}

export default function SignOutPage() {
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useUser();
  const doneRef = useRef(false);
  const [signOutDone, setSignOutDone] = useState(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    clearAllAuthState();

    const failsafe = window.setTimeout(() => {
      clearAllAuthState();
      window.location.replace("/login?force=1");
    }, FAILSAFE_MS);

    void (async () => {
      try {
        await clerk.signOut();
      } catch { /* ignore */ }
      clearAllAuthState();
      setSignOutDone(true);
    })();

    return () => window.clearTimeout(failsafe);
  }, [clerk]);

  useEffect(() => {
    if (!signOutDone) return;
    if (!isLoaded) return;
    if (isSignedIn) {
      clearAllAuthState();
      return;
    }
    window.location.replace("/login");
  }, [signOutDone, isLoaded, isSignedIn]);

  return <PageLoader label="Déconnexion…" ready minDuration={300} persist static />;
}
