"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import PageLoader from "@/components/ui/PageLoader";
import NativeBrandedLoader from "@/components/native/NativeBrandedLoader";
import { useIsNativeAppSync } from "@/lib/native/useIsNativeAppSync";
import { SIGNOUT_HANDOFF_KEY } from "@/lib/auth/signoutHandoff";
import { beginAuthTransition } from "@/lib/native/authTransition";

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

/**
 * Clear the native Google/Apple session so the NEXT sign-in shows the account
 * chooser instead of silently reusing the same account. Auth.js `signOut()`
 * only clears the web/JWT cookie — the @capgo/capacitor-social-login native
 * session survives it, which is why logging out "auto-reconnected" the user.
 * Best-effort + per-provider allSettled: an unsupported provider (Apple logout
 * can be a no-op) never blocks the sign-out.
 */
async function clearNativeSocialSession() {
  if (typeof window === "undefined") return;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (typeof cap?.isNativePlatform !== "function" || !cap.isNativePlatform()) return;
  try {
    const mod = (await import("@capgo/capacitor-social-login")) as unknown as {
      SocialLogin?: { logout?: (o: { provider: string }) => Promise<unknown> };
    };
    const SocialLogin = mod.SocialLogin;
    if (!SocialLogin?.logout) return;
    await Promise.allSettled([
      SocialLogin.logout({ provider: "google" }),
      SocialLogin.logout({ provider: "apple" }),
    ]);
  } catch {
    /* sdk missing / not native — ignore */
  }
}

export default function SignOutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const doneRef = useRef(false);
  const isNative = useIsNativeAppSync();

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    // Show the single branded (purple + paw) cover for the whole logout → login
    // transition (survives the hard navigation to /login below).
    beginAuthTransition();

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

    function navigateOut() {
      // Native: client-side nav (NOT a hard window.location). A hard nav tears
      // down the document, and during the WKWebView commit gap iOS paints its
      // own backgroundColor (#7c3aed, capacitor.config.ts) WITHOUT the logo →
      // a "mini flash écran violet". A client nav keeps the root-layout
      // #ds-auth-splash mounted the whole way to /login. The SIGNOUT_HANDOFF
      // flag (set in markHandoff) still suppresses the /login auto-redirect
      // bounce, so we don't need a fresh document to clear the session cache.
      if (isNative) {
        router.replace(safeRedirect);
        return;
      }
      window.location.replace(safeRedirect);
    }

    const failsafe = window.setTimeout(() => {
      // signOut hung (unlikely). Force the redirect anyway — Auth.js may
      // still complete cookie clearing on the next request because
      // /api/auth/signout is idempotent.
      clearLegacyAuthCookies();
      markHandoff();
      navigateOut();
    }, FAILSAFE_MS);

    void (async () => {
      // Clear the native social session first so the next login shows the
      // account chooser (independent of whether the cookie clear succeeds).
      await clearNativeSocialSession();
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
      navigateOut();
    })();

    return () => window.clearTimeout(failsafe);
  }, [searchParams, isNative, router]);

  // Native: the branded cover (purple + paw) — no skeleton. Web: unchanged.
  if (isNative) return <NativeBrandedLoader />;
  return <PageLoader label="Déconnexion…" ready minDuration={300} persist static />;
}
