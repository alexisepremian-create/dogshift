"use client";

/**
 * Login form — Auth.js v5 (NextAuth).
 *
 * Two paths:
 *   1. "Continue with Google" → `signIn("google")` redirects through Auth.js's
 *      Google provider, lands on /post-login afterward.
 *   2. Email + password → `signIn("credentials", { redirect: false })`. On
 *      success the SessionProvider picks up the new cookie, we navigate to
 *      /post-login which decides /host vs /account based on role.
 *
 * Errors we surface explicitly:
 *   - `MIGRATED_NO_PASSWORD` → the Credentials provider throws this when the
 *     User exists but has no `passwordHash` (typical of Clerk-imported users
 *     and Google-only accounts). UI tells them to use /forgot-password.
 *   - `CredentialsSignin` → wrong email/password combination.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

import { reportApiError } from "@/lib/observability/reportApiError";

function normalizeEmail(input: string) {
  return input.replace(/\s+/g, "").trim().toLowerCase();
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const next = (searchParams?.get("next") ?? "").trim();
  const startGoogle = (searchParams?.get("startGoogle") ?? "").trim();
  const startGoogleMode = startGoogle === "1" || startGoogle.toLowerCase() === "true";
  const resetOk = searchParams?.get("reset") === "ok";
  const callbackUrl = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthInFlight, setOauthInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoGoogleStarted, setAutoGoogleStarted] = useState(false);

  const inputDisabled = loading || oauthInFlight;
  const formDisabled = loading || oauthInFlight;

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError("Merci d'entrer une adresse email valide.");
      return;
    }
    if (!password) {
      setError("Merci d'entrer ton mot de passe.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: normalized,
        password,
        redirect: false,
      });

      if (!res) {
        setError("Connexion impossible pour l'instant. Réessaie dans un instant.");
        setLoading(false);
        return;
      }

      if (res.error) {
        // Auth.js v5 surfaces our authorize() throws as `error` strings.
        if (res.error === "MIGRATED_NO_PASSWORD" || res.code === "MIGRATED_NO_PASSWORD") {
          setError(
            "Ce compte n'a pas encore de mot de passe DogShift. Clique sur « Mot de passe oublié ? » pour en définir un.",
          );
        } else if (res.error === "CredentialsSignin") {
          setError("Email ou mot de passe incorrect.");
        } else {
          setError("Connexion impossible. Vérifie tes identifiants et réessaie.");
        }
        reportApiError({
          kind: "unauthorized",
          code: res.error || "LOGIN_FAILED",
          route: "auth.login.credentials",
        });
        setLoading(false);
        return;
      }

      // Success — route to /post-login which decides where to land.
      router.replace(callbackUrl);
    } catch (err) {
      reportApiError({
        kind: "internal_error",
        code: "LOGIN_EXCEPTION",
        route: "auth.login.credentials",
        extra: { message: err instanceof Error ? err.message : String(err) },
      });
      setError("Une erreur est survenue. Réessaie dans un instant.");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (oauthInFlight) return;
    setError(null);
    setOauthInFlight(true);
    try {
      await signIn("google", { callbackUrl, redirect: true });
    } catch (err) {
      reportApiError({
        kind: "upstream_error",
        code: "GOOGLE_OAUTH_FAILED",
        route: "auth.login.google",
      });
      setError("Connexion Google impossible. Réessaie dans un instant.");
      setOauthInFlight(false);
      void err;
    }
  }

  useEffect(() => {
    if (!startGoogleMode) return;
    if (autoGoogleStarted) return;
    if (status === "authenticated") return;
    setAutoGoogleStarted(true);
    void handleGoogle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGoogleStarted, startGoogleMode, status]);

  return (
    <div className="flex flex-col">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
        S&apos;identifier
      </h1>
      <p className="mt-2 text-center text-sm text-slate-600">Accède à ton espace DogShift.</p>

      {resetOk ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900">
          Mot de passe mis à jour ✅ — connecte-toi avec ton nouveau mot de passe.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={oauthInFlight}
          aria-busy={oauthInFlight}
          className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {oauthInFlight ? "Redirection…" : "Continuer avec Google"}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleCredentialsSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={inputDisabled}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="toi@exemple.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              Mot de passe
            </label>
            <div className="relative mt-2">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={inputDisabled}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={formDisabled}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            <div className="mt-2 text-right">
              <Link
                href="/forgot-password"
                className="text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-sm text-rose-900">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={formDisabled}
            className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-slate-600">
        Pas encore de compte ?{" "}
        <Link
          href="/signup"
          className="font-semibold text-slate-900 hover:underline underline-offset-2"
        >
          Créer un compte
        </Link>
      </p>

      <p className="mt-6 text-center text-xs text-slate-500">
        En continuant, tu acceptes nos{" "}
        <Link href="/cgu" className="underline underline-offset-2 hover:text-slate-700">
          conditions d&apos;utilisation
        </Link>
        .
      </p>
    </div>
  );
}
