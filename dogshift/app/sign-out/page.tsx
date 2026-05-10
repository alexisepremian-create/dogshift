"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import PageLoader from "@/components/ui/PageLoader";

export const dynamic = "force-dynamic";

const FAILSAFE_MS = 5000;

function getRedirectTarget(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const r = (params.get("redirect") ?? "").trim();
    if (r.startsWith("/") && !r.startsWith("//")) return r;
  } catch { /* ignore */ }
  return "/login?force=1";
}

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
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    clearAllAuthState();
    const target = getRedirectTarget();

    const redirect = () => {
      window.location.replace(target);
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
