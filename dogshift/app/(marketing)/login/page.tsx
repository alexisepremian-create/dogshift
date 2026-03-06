"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignOutButton, useAuth, useUser } from "@clerk/nextjs";

import AuthLayout from "@/components/auth/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const { isLoaded: authLoaded, userId: authUserId, isSignedIn: authIsSignedIn } = useAuth();

  const force = (searchParams?.get("force") ?? "").trim();
  const forceMode = force === "1" || force.toLowerCase() === "true";

  const debugAuth = (searchParams?.get("debugAuth") ?? "").trim();
  const debugMode = debugAuth === "1" || debugAuth.toLowerCase() === "true";
  const debugToken = (searchParams?.get("token") ?? "").trim();

  const [serverDebug, setServerDebug] = useState<any>(null);
  const [serverDebugError, setServerDebugError] = useState<string | null>(null);

  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;
    if (forceMode) return;
    router.replace("/post-login");
  }, [forceMode, isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!debugMode) return;
    if (!authLoaded) return;
    console.log("[login][debug][client]", { authLoaded, authIsSignedIn, authUserId, userIsSignedIn: isSignedIn });
  }, [authIsSignedIn, authLoaded, authUserId, debugMode, isSignedIn]);

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
  }, [debugMode, debugToken]);

  return (
    <AuthLayout>
      {debugMode ? (
        <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">Debug Auth</p>
          <p className="mt-2 text-xs font-medium text-amber-900/80">Client</p>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-white/70 p-3 text-[11px] text-slate-900 ring-1 ring-amber-200">
            {JSON.stringify(
              {
                authLoaded,
                authIsSignedIn,
                authUserId,
                userHook: { isLoaded, isSignedIn },
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

          <div className="mt-4">
            <SignOutButton redirectUrl="/login?force=1">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                SignOutButton (Clerk natif)
              </button>
            </SignOutButton>
          </div>
        </div>
      ) : null}

      {isLoaded && isSignedIn && forceMode ? (
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Vous êtes déjà connecté.</p>
          <p className="mt-1 text-sm text-slate-600">Pour tester un autre compte, déconnectez-vous puis reconnectez-vous.</p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={switching}
              onClick={() => {
                if (switching) return;
                setSwitching(true);
                setSwitchError(null);
                try {
                  window.localStorage.removeItem("ds_auth_user");
                } catch {
                  // ignore
                }
                window.location.assign("/sign-out?redirect=%2Flogin%3Fforce%3D1%26startGoogle%3D1");
              }}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {switching ? "Déconnexion…" : "Changer de compte"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/post-login")}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Aller à mon espace
            </button>
          </div>

          {switchError ? <p className="mt-3 text-sm font-medium text-rose-600">{switchError}</p> : null}
        </div>
      ) : null}

      <LoginForm />
    </AuthLayout>
  );
}
