"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import PageLoader from "@/components/ui/PageLoader";
import { withPublicOrigin } from "@/lib/url/publicOrigin";

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
  const [ready, setReady] = useState(false);
  const [afterPath, setAfterPath] = useState("/post-login");

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return;
    setAfterPath(readStoredRedirectPath());
    setReady(true);
  }, []);

  return (
    <>
      <PageLoader label="Connexion…" persist />
      {ready ? (
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl={withPublicOrigin(afterPath)}
          signUpFallbackRedirectUrl={withPublicOrigin(afterPath)}
          signInForceRedirectUrl={withPublicOrigin(afterPath)}
          signUpForceRedirectUrl={withPublicOrigin(afterPath)}
          continueSignUpUrl={withPublicOrigin("/login?force=1")}
        />
      ) : null}
    </>
  );
}
