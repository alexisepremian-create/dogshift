"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignOutPage() {
  const { isLoaded: authLoaded } = useAuth();
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const startedRef = useRef(false);

  const redirect = useMemo(() => {
    return (searchParams?.get("redirect") ?? "").trim() || "/login?force=1";
  }, [searchParams]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const fallback = window.setTimeout(() => {
      window.location.assign(redirect);
    }, 3500);

    return () => {
      window.clearTimeout(fallback);
    };
  }, [redirect]);

  useEffect(() => {
    if (!authLoaded) return;

    (async () => {
      try {
        window.localStorage.removeItem("ds_auth_user");
      } catch {
        // ignore
      }

      const signOutAttempt = (async () => {
        try {
          await (clerk as any).signOut({ sessionId: "all" });
        } catch {
          await clerk.signOut();
        }
      })();

      const timeout = new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1800);
      });

      try {
        await Promise.race([signOutAttempt, timeout]);
      } finally {
        router.replace(redirect);
        setTimeout(() => {
          window.location.assign(redirect);
        }, 100);
      }
    })();
  }, [authLoaded, clerk, redirect, router]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Déconnexion…</p>
        <p className="mt-2 text-sm text-slate-600">Tu vas être redirigé vers la page de connexion.</p>

        <button
          type="button"
          onClick={() => window.location.assign(redirect)}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          Continuer vers la connexion
        </button>
      </div>
    </main>
  );
}
