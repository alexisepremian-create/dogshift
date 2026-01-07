"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const next = (searchParams?.get("next") ?? "").trim();
  const [error] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    router.replace("/account");
  }, [status, router]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Inscription</h1>
          <p className="mt-2 text-sm text-slate-600">Créez votre compte propriétaire.</p>

          <div className="mt-8 space-y-4" aria-label="Formulaire d'inscription">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() =>
                void signIn("google")
              }
              className="w-full rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continuer avec Google
            </button>
          </div>

          <p className="mt-6 text-sm text-slate-600">
            Déjà un compte?{" "}
            <Link href="/login" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
              Se connecter
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
