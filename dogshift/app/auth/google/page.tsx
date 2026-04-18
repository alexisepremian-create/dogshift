"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

export const dynamic = "force-dynamic";

const OAUTH_AFTER_KEY = "ds_oauth_after";

function absUrl(path: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  const p = (path || "").trim();
  if (!p) return `${origin}/post-login`;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return `${origin}${p.startsWith("/") ? p : `/${p}`}`;
}

function readStoredRedirectPath(): string {
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
  const clerk = useClerk();
  const startedRef = useRef(false);
  const [misconfig, setMisconfig] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      setMisconfig(true);
      return;
    }
    if (!clerk.loaded) return;
    if (startedRef.current) return;
    startedRef.current = true;

    const afterPath = readStoredRedirectPath();
    const afterAbs = absUrl(afterPath);
    const loginAbs = absUrl("/login?force=1");

    void (async () => {
      try {
        await clerk.handleRedirectCallback({
          signInUrl: absUrl("/login"),
          signUpUrl: absUrl("/login"),
          signInFallbackRedirectUrl: afterAbs,
          signUpFallbackRedirectUrl: afterAbs,
          continueSignUpUrl: absUrl("/login"),
        });
      } catch (e) {
        console.error("[auth/google] handleRedirectCallback", e);
        window.location.replace(loginAbs);
        return;
      }
      // Full navigation so session cookies are visible to middleware + /api on the next document.
      window.location.replace(afterAbs);
    })();
  }, [clerk, clerk.loaded]);

  if (misconfig) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-medium text-rose-700">Configuration d’authentification incomplète.</p>
        <a className="text-sm font-semibold text-slate-900 underline" href="/login">
          Retour à la connexion
        </a>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white font-sans"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="text-[13px] font-medium tracking-[0.18em] text-slate-400">Connexion…</p>
    </div>
  );
}
