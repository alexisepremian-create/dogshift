"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import AuthLayout from "@/components/auth/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";
import { useCanonicalDogshiftHostRedirect } from "@/lib/url/useCanonicalDogshiftHost";

/**
 * Login page wrapper.
 *
 * Renders `<LoginForm />` (the form is self-contained with Auth.js
 * signIn() calls). Adds:
 *  - Auto-redirect to /post-login if the user is already authenticated.
 *  - `?force=1` mode → tries to sign out, falls back to /sign-out manually.
 *  - `?debugAuth=1&token=...` mode → debug panel showing session + server view.
 */
export default function LoginPage() {
  useCanonicalDogshiftHostRedirect();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const isLoaded = status !== "loading";
  const isSignedIn = status === "authenticated";
  const userId = session?.user?.id ?? null;

  const force = (searchParams?.get("force") ?? "").trim();
  const forceMode = force === "1" || force.toLowerCase() === "true";

  const debugAuth = (searchParams?.get("debugAuth") ?? "").trim();
  const debugMode = debugAuth === "1" || debugAuth.toLowerCase() === "true";
  const debugToken = (searchParams?.get("token") ?? "").trim();

  const [serverDebug, setServerDebug] = useState<any>(null);
  const [serverDebugError, setServerDebugError] = useState<string | null>(null);

  const [clientErrors, setClientErrors] = useState<Array<{ ts: number; type: string; message: string }>>([]);
  const [signOutAttempting, setSignOutAttempting] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Track whether the user was ALREADY signed in when the page first loaded.
  const alreadySignedInOnLoad = useRef<boolean | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    if (alreadySignedInOnLoad.current === null) {
      alreadySignedInOnLoad.current = !!isSignedIn;
    }
  }, [isLoaded, isSignedIn]);

  const next = (searchParams?.get("next") ?? "").trim();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;
    // Block auto-redirect only if user landed already-signed-in in forceMode.
    if (forceMode && alreadySignedInOnLoad.current === true) return;
    const dest = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";
    router.replace(dest);
  }, [forceMode, isLoaded, isSignedIn, next, router]);

  useEffect(() => {
    if (!debugMode) return;
    if (!isLoaded) return;
    console.log("[login][debug][client]", { isLoaded, isSignedIn, userId });
  }, [debugMode, isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (!debugMode) return;
    if (!debugToken) {
      setServerDebugError("Missing token");
      return;
    }

    const url = `/api/debug/auth?token=${encodeURIComponent(debugToken)}`;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || `HTTP_${res.status}`);
        }
        setServerDebug(json);
        setServerDebugError(null);
      })
      .catch((err) => {
        setServerDebug(null);
        setServerDebugError(err instanceof Error ? err.message : "FETCH_FAILED");
      });
  }, [debugMode, debugToken, signOutAttempting]);

  useEffect(() => {
    if (!debugMode) return;

    const onError = (event: ErrorEvent) => {
      setClientErrors((prev) => {
        const nextErrs = [{ ts: Date.now(), type: "error", message: event.message || "UNKNOWN_ERROR" }, ...prev];
        return nextErrs.slice(0, 10);
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "UNHANDLED_REJECTION";
      setClientErrors((prev) => {
        const nextErrs = [{ ts: Date.now(), type: "unhandledrejection", message }, ...prev];
        return nextErrs.slice(0, 10);
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [debugMode]);

  return (
    <AuthLayout>
      {debugMode ? (
        <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">Debug Auth</p>
          <p className="mt-2 text-xs font-medium text-amber-900/80">Client</p>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-white/70 p-3 text-[11px] text-slate-900 ring-1 ring-amber-200">
            {JSON.stringify(
              {
                isLoaded,
                isSignedIn,
                userId,
                email: session?.user?.email ?? null,
                role: (session?.user as { role?: string } | undefined)?.role ?? null,
                url: typeof window !== "undefined" ? window.location.href : null,
              },
              null,
              2,
            )}
          </pre>

          <p className="mt-4 text-xs font-medium text-amber-900/80">Server</p>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-white/70 p-3 text-[11px] text-slate-900 ring-1 ring-amber-200">
            {serverDebugError ? serverDebugError : JSON.stringify(serverDebug, null, 2)}
          </pre>

          <p className="mt-4 text-xs font-medium text-amber-900/80">Client errors</p>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-white/70 p-3 text-[11px] text-slate-900 ring-1 ring-amber-200">
            {clientErrors.length ? JSON.stringify(clientErrors, null, 2) : "(none)"}
          </pre>

          <div className="mt-4">
            <button
              type="button"
              disabled={signOutAttempting}
              onClick={async () => {
                if (signOutAttempting) return;
                setSignOutAttempting(true);
                setSignOutError(null);
                try {
                  await signOut({ callbackUrl: "/login?force=1" });
                } catch (err) {
                  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "SIGN_OUT_FAILED";
                  setSignOutError(message);
                } finally {
                  setTimeout(() => setSignOutAttempting(false), 300);
                }
              }}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signOutAttempting ? "Sign out…" : "Manual signOut() test"}
            </button>
            {signOutError ? <p className="mt-2 text-xs font-semibold text-rose-700">{signOutError}</p> : null}
          </div>
        </div>
      ) : null}

      {isLoaded && isSignedIn && forceMode && alreadySignedInOnLoad.current === true ? (
        <ForceSignOut />
      ) : (
        <LoginForm />
      )}
    </AuthLayout>
  );
}

/**
 * Shown when the user arrives at /login?force=1 but is still signed in
 * (sign-out didn't fully clear the session). Automatically retries signOut
 * and shows a manual fallback after 3s.
 */
function ForceSignOut() {
  const [retrying, setRetrying] = useState(true);
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;

    void (async () => {
      try {
        await signOut({ redirect: false });
      } catch {
        /* ignore */
      }
      window.location.replace("/login");
    })();

    const giveUp = setTimeout(() => setRetrying(false), 3000);
    return () => clearTimeout(giveUp);
  }, []);

  if (retrying) {
    return (
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Déconnexion en cours…</p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Vous êtes toujours connecté.</p>
      <p className="mt-1 text-sm text-slate-600">La déconnexion automatique n&apos;a pas fonctionné.</p>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => window.location.assign("/sign-out")}
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Réessayer la déconnexion
        </button>
      </div>
    </div>
  );
}
