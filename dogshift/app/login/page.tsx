"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const next = (searchParams?.get("next") ?? "").trim();
  const callbackUrlRaw = (searchParams?.get("callbackUrl") ?? "/").trim();
  const callbackUrl = (() => {
    if (!callbackUrlRaw) return "/";
    if (typeof window === "undefined") return "/";
    try {
      const u = new URL(callbackUrlRaw, window.location.origin);
      if (u.origin !== window.location.origin) return "/";
      const path = `${u.pathname}${u.search}${u.hash}`;
      if (!path.startsWith("/")) return "/";
      if (path.startsWith("//")) return "/";
      if (path.startsWith("/api")) return "/";
      if (path.startsWith("/_next")) return "/";
      return path;
    } catch {
      if (!callbackUrlRaw.startsWith("/")) return "/";
      if (callbackUrlRaw.startsWith("//")) return "/";
      if (callbackUrlRaw.startsWith("/api")) return "/";
      if (callbackUrlRaw.startsWith("/_next")) return "/";
      return callbackUrlRaw;
    }
  })();
  const errorFromQuery = (searchParams?.get("error") ?? "").trim();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    const target = next ? next : callbackUrl;
    router.replace(target);
  }, [status, router, next, callbackUrl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!errorFromQuery) return;
    if (errorFromQuery === "CredentialsSignin") {
      setError("Email ou mot de passe incorrect.");
      return;
    }
    if (errorFromQuery === "GOOGLE_ONLY") {
      setError(
        "Ce compte est lié à Google.\nConnectez-vous avec Google. Vous pourrez ajouter un mot de passe plus tard dans les paramètres."
      );
      return;
    }
    if (errorFromQuery === "Callback") {
      setError("Une erreur est survenue pendant la connexion. Réessaie.");
      return;
    }
    setError("Une erreur est survenue pendant la connexion. Réessaie.");
  }, [errorFromQuery]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Connexion</h1>
          <p className="mt-2 text-sm text-slate-600">Accédez à votre espace DogShift.</p>

          <div className="mt-8 space-y-4" aria-label="Formulaire de connexion" suppressHydrationWarning>
            {error ? (
              <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                <div>{error}</div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void signIn("google", { callbackUrl });
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continuer avec Google
            </button>

            {!mounted ? null : (
              <div className="pt-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                placeholder="vous@exemple.com"
              />

              <label htmlFor="password" className="mt-4 block text-sm font-medium text-slate-700">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                placeholder="Votre mot de passe"
              />
              <button
                type="button"
                disabled={submitting || !email.trim() || !password}
                onClick={async () => {
                  const normalizedEmail = email.trim();
                  if (!normalizedEmail) return;

                  setSubmitting(true);
                  setError(null);

                  try {
                    const res = await signIn("credentials", {
                      email: normalizedEmail,
                      password,
                      callbackUrl,
                      redirect: false,
                    });
                    if (res?.error) {
                      setError(res.error === "CredentialsSignin" ? "Email ou mot de passe incorrect." : res.error);
                      return;
                    }
                    router.push(callbackUrl);
                  } catch (err) {
                    setError("Email ou mot de passe incorrect.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="mt-3 w-full rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                Se connecter
              </button>
              </div>
            )}
          </div>

          <p className="mt-6 text-sm text-slate-600">
            Pas encore de compte?{" "}
            <Link href="/register" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
              Créer un compte
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
