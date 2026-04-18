"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import PageLoader from "@/components/ui/PageLoader";
import { withPublicOrigin } from "@/lib/url/publicOrigin";

export default function SignOutPage() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const startedRef = useRef(false);

  const redirectRef = useRef(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("redirect")?.trim() || "/login?force=1"
      : "/login?force=1",
  );

  useEffect(() => {
    if (!authLoaded || startedRef.current) return;
    startedRef.current = true;
    try { window.localStorage.removeItem("ds_auth_user"); } catch {}
  }, [authLoaded]);

  function handleDone() {
    const target = withPublicOrigin(redirectRef.current);
    let settled = false;
    const hardRedirect = () => {
      if (settled) return;
      settled = true;
      window.location.replace(target || "/login?force=1");
    };

    // Session already gone (e.g. account deleted server-side) — do not wait on signOut().
    if (!isSignedIn) {
      hardRedirect();
      return;
    }

    const failSafe = window.setTimeout(hardRedirect, 5000);

    void (async () => {
      try {
        await Promise.resolve(clerk.signOut({ redirectUrl: target }));
      } catch {
        /* deleted / invalid session */
      }
      window.clearTimeout(failSafe);
      window.setTimeout(hardRedirect, 400);
    })();
  }

  return (
    <PageLoader
      label="Déconnexion…"
      ready={authLoaded}
      onDone={handleDone}
      minDuration={2200}
      persist
    />
  );
}
