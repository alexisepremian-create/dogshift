"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSignIn, useUser } from "@clerk/nextjs";
import Link from "next/link";

function normalizeEmail(input: string) {
  return input.replace(/\s+/g, "").trim().toLowerCase();
}

export default function LoginForm() {
  const { signIn, fetchStatus } = useSignIn();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const next = (searchParams?.get("next") ?? "").trim();
  const force = (searchParams?.get("force") ?? "").trim();
  const forceMode = force === "1" || force.toLowerCase() === "true";
  const startGoogle = (searchParams?.get("startGoogle") ?? "").trim();
  const startGoogleMode = startGoogle === "1" || startGoogle.toLowerCase() === "true";
  const redirectAfterAuth = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoGoogleStarted, setAutoGoogleStarted] = useState(false);

  const fetching = fetchStatus === "fetching";
  const disabled = fetching || loading || !signIn;

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError("Merci d'entrer une adresse email valide.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // Clerk v7: create the sign-in attempt, then send the email code
      const createResult = await (signIn as any).create({ identifier: normalized });
      if (createResult?.error) throw new Error(createResult.error.message ?? "Erreur de connexion.");

      const sendResult = await (signIn as any).emailCode.sendCode({ emailAddress: normalized });
      if (sendResult?.error) throw new Error(sendResult.error.message ?? "Impossible d'envoyer le code.");

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le lien. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailCodeVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn || loading) return;

    const code = emailCode.replace(/\s+/g, "").trim();
    if (!code) {
      setError("Merci d'entrer le code reçu par email.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const verifyResult = await (signIn as any).emailCode.verifyCode({ code });
      if (verifyResult?.error) throw new Error(verifyResult.error.message ?? "Code invalide.");

      if ((signIn as any).status === "complete") {
        await (signIn as any).finalize({
          navigate: ({ decorateUrl }: { decorateUrl: (url: string) => string }) => {
            const url = decorateUrl(redirectAfterAuth);
            if (url.startsWith("http")) {
              window.location.href = url;
            } else {
              router.replace(url);
            }
          },
        });
        return;
      }

      setError("Connexion incomplète. Réessaie.");
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide.");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!signIn || loading) return;

    setError(null);
    setLoading(true);
    try {
      // Clerk v7: signIn.sso() replaces authenticateWithRedirect()
      const ssoResult = await (signIn as any).sso({
        strategy: "oauth_google",
        redirectCallbackUrl: "/auth/google",
        redirectUrl: redirectAfterAuth,
        ...(forceMode
          ? { oauthOptions: { prompt: "consent select_account" } }
          : null),
      });
      if (ssoResult?.error) throw new Error(ssoResult.error.message ?? "Connexion Google impossible.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion Google impossible. Réessaie.");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!startGoogleMode) return;
    if (autoGoogleStarted) return;
    if (!signIn) return;
    if (!userLoaded) return;
    if (isSignedIn) return;
    setAutoGoogleStarted(true);
    void handleGoogle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGoogleStarted, signIn, startGoogleMode, userLoaded, isSignedIn]);

  return (
    <div className="flex flex-col">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">S'identifier</h1>
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

        {!sent ? (
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

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </form>
        ) : (
          <form onSubmit={handleEmailCodeVerify} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="email-code">
                Code reçu par e-mail
              </label>
              <input
                id="email-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                disabled={disabled}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="123456"
              />
              <p className="mt-2 text-sm text-slate-600">Un code vient d'être envoyé. Vérifie ta boîte mail (et les spams).</p>
            </div>

            <button
              type="submit"
              disabled={disabled}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Vérification…" : "Valider le code"}
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (loading) return;
                setSent(false);
                setEmailCode("");
                setError(null);
              }}
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Changer d'email
            </button>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </form>
        )}
      </div>

      <p className="mt-8 text-center text-sm text-slate-600">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="font-semibold text-slate-900 hover:underline underline-offset-2">
          Créer un compte
        </Link>
      </p>

      <p className="mt-6 text-center text-xs text-slate-500">
        En continuant, tu acceptes nos{" "}
        <Link href="/cgu" className="underline underline-offset-2 hover:text-slate-700">
          conditions d'utilisation
        </Link>
        .
      </p>
    </div>
  );
}
