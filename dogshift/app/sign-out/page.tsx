"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignOutPage() {
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!(clerk as any)?.loaded) return;
    startedRef.current = true;

    const redirect = (searchParams?.get("redirect") ?? "").trim() || "/login?force=1";

    const fallback = window.setTimeout(() => {
      window.location.assign(redirect);
    }, 2500);

    (async () => {
      try {
        window.localStorage.removeItem("ds_auth_user");
      } catch {
        // ignore
      }

      try {
        try {
          // Some Clerk environments ignore redirectUrl, so we always redirect ourselves after.
          await (clerk as any).signOut({ redirectUrl: redirect, sessionId: "all" });
        } catch {
          await clerk.signOut();
        }
      } catch {
        // ignore
      } finally {
        window.clearTimeout(fallback);
        router.replace(redirect);
        setTimeout(() => {
          window.location.assign(redirect);
        }, 100);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerk, router, searchParams]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Déconnexion…</p>
        <p className="mt-2 text-sm text-slate-600">Tu vas être redirigé vers la page de connexion.</p>
      </div>
    </main>
  );
}
