"use client";

/**
 * Sign-up form — Auth.js v5 (credentials provider) + Google OAuth.
 *
 * Flow:
 *   1. POST /api/auth/register with email + password (+ optional name).
 *      That endpoint creates the User row with a bcrypt-hashed passwordHash
 *      and sends the email verification link.
 *   2. We immediately call `signIn("credentials", { redirect: false })` so
 *      the user is signed in without a second password prompt — this is the
 *      industry standard "register-then-login" UX. The email verification
 *      link is independent: clicking it later just flips `emailVerified`.
 *   3. On success → router.replace("/post-login") which routes to /account
 *      (default OWNER role) or /host if the user picked the sitter intent.
 *
 * For Google: `signIn("google")` redirects. PrismaAdapter creates the row.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

import { reportApiError } from "@/lib/observability/reportApiError";

function normalizeEmail(input: string) {
  return input.replace(/\s+/g, "").trim().toLowerCase();
}

function passwordIsStrong(pw: string): boolean {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
}

export default function SignUpForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [intent, setIntent] = useState<"owner" | "sitter">("owner");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthInFlight, setOauthInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputDisabled = loading || oauthInFlight;
  const formDisabled = loading || oauthInFlight || !accepted;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setError("Merci d'entrer une adresse email valide.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!passwordIsStrong(password)) {
      setError("Mot de passe trop faible : 8 caractères minimum, avec au moins une majuscule et un chiffre.");
      return;
    }
    if (!accepted) {
      setError("Tu dois accepter les conditions d'utilisation pour continuer.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          name: name.trim() || null,
          intent,
        }),
      });
      const body = (await registerRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!registerRes.ok || !body.ok) {
        if (body.error === "EMAIL_ALREADY_REGISTERED") {
          setError(
            "Un compte existe déjà pour cet email. Va sur la page de connexion (ou utilise « Mot de passe oublié » si tu ne t'en souviens plus).",
          );
        } else if (body.error === "WEAK_PASSWORD") {
          setError("Mot de passe trop faible : 8 caractères, avec majuscule et chiffre.");
        } else {
          setError("Inscription impossible. Réessaie dans un instant.");
        }
        setLoading(false);
        return;
      }

      const loginRes = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      });
      if (!loginRes || loginRes.error) {
        router.replace("/login?registered=1");
        return;
      }

      router.replace("/post-login");
    } catch (err) {
      reportApiError({
        kind: "internal_error",
        code: "SIGNUP_EXCEPTION",
        route: "auth.signup",
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
      await signIn("google", { callbackUrl: "/post-login", redirect: true });
    } catch (err) {
      reportApiError({
        kind: "upstream_error",
        code: "GOOGLE_OAUTH_FAILED",
        route: "auth.signup.google",
      });
      setError("Connexion Google impossible. Réessaie dans un instant.");
      setOauthInFlight(false);
      void err;
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
        Créer un compte
      </h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        Rejoins DogShift en moins d&apos;une minute.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={oauthInFlight}
          aria-busy={oauthInFlight}
          className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {oauthInFlight ? "Redirection…" : "S'inscrire avec Google"}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Je suis…</legend>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex cursor-pointer items-center justify-center rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                  intent === "owner"
                    ? "border-violet-500 bg-violet-50 text-violet-900"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="intent"
                  value="owner"
                  checked={intent === "owner"}
                  onChange={() => setIntent("owner")}
                  className="sr-only"
                />
                Propriétaire de chien
              </label>
              <label
                className={`flex cursor-pointer items-center justify-center rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                  intent === "sitter"
                    ? "border-violet-500 bg-violet-50 text-violet-900"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="intent"
                  value="sitter"
                  checked={intent === "sitter"}
                  onChange={() => setIntent("sitter")}
                  className="sr-only"
                />
                Je veux devenir sitter
              </label>
            </div>
          </fieldset>

          <div>
            <label htmlFor="su-name" className="block text-sm font-medium text-slate-700">
              Prénom (optionnel)
            </label>
            <input
              id="su-name"
              type="text"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={inputDisabled}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Alex"
              maxLength={80}
            />
          </div>

          <div>
            <label htmlFor="su-email" className="block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="su-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={inputDisabled}
              required
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="toi@exemple.com"
            />
          </div>

          <div>
            <label htmlFor="su-password" className="block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <div className="relative mt-2">
              <input
                id="su-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={inputDisabled}
                required
                minLength={8}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="8 caractères, 1 majuscule, 1 chiffre"
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
          </div>

          <div>
            <label htmlFor="su-confirm" className="block text-sm font-medium text-slate-700">
              Confirme le mot de passe
            </label>
            <input
              id="su-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={inputDisabled}
              required
              minLength={8}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              disabled={inputDisabled}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              J&apos;accepte les{" "}
              <Link href="/cgu" className="underline underline-offset-2 hover:text-slate-900">
                conditions d&apos;utilisation
              </Link>{" "}
              et la{" "}
              <Link
                href="/politique-confidentialite"
                className="underline underline-offset-2 hover:text-slate-900"
              >
                politique de confidentialité
              </Link>
              .
            </span>
          </label>

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
            {loading ? "Création du compte…" : "Créer mon compte"}
          </button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-slate-600">
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-semibold text-slate-900 hover:underline underline-offset-2"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
