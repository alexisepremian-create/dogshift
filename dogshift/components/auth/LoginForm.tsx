"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";

function normalizeEmail(input: string) {
  return input.replace(/\s+/g, "").trim().toLowerCase();
}

export default function LoginForm() {
  const { isLoaded, signIn } = useSignIn();
  const searchParams = useSearchParams();

  const next = (searchParams?.get("next") ?? "").trim();
  const redirectAfterAuth = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError("Merci d’entrer une adresse email valide.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // Clerk headless magic link:
      // - Creates an email-link sign-in attempt.
      // - The user completes sign-in by clicking the link received by email.
      await (signIn as any).create({
        identifier: normalized,
        strategy: "email_link",
        redirectUrl: "/login",
        redirectUrlComplete: redirectAfterAuth,
      });
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message || "Impossible d’envoyer le lien. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!isLoaded || !signIn) return;

    setError(null);
    setLoading(true);
    try {
      // Clerk headless OAuth:
      // - Redirects to Google, then back to the app.
      // - Completion lands on /post-login (which routes to next or /account).
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/login",
        redirectUrlComplete: redirectAfterAuth,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message || "Connexion Google impossible. Réessaie.");
      setLoading(false);
    }
  }

  const disabled = !isLoaded || loading;

  return (
    <div className="flex flex-col">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">S’identifier</h1>
      <p className="mt-2 text-center text-sm text-slate-600">Accède à ton espace DogShift.</p>

      <div className="mt-6 flex flex-col gap-6">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={disabled}
          className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continuer avec Google
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-5">
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
            disabled={disabled}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="toi@exemple.com"
          />
        </div>

        <button
          type="submit"
          disabled={disabled}
          className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Envoi…" : "Se connecter par e-mail"}
        </button>

        {sent ? (
          <p className="text-sm text-slate-600">Lien envoyé. Vérifie ta boîte mail pour continuer.</p>
        ) : null}

        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : null}
        </form>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        En continuant, tu acceptes nos{" "}
        <Link href="/cgu" className="underline underline-offset-2 hover:text-slate-700">
          conditions d’utilisation
        </Link>
        .
      </p>
    </div>
  );
}
