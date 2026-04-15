"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSignIn, useUser } from "@clerk/nextjs";
import Link from "next/link";

function normalizeEmail(input: string) {
  return input.replace(/\s+/g, "").trim().toLowerCase();
}

type Step = "email" | "password" | "emailCode";
type VerifyMode = "emailCode" | "mfa";

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
  const [password, setPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [verifyMode, setVerifyMode] = useState<VerifyMode>("emailCode");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoGoogleStarted, setAutoGoogleStarted] = useState(false);

  const fetching = fetchStatus === "fetching";
  const disabled = fetching || loading || !signIn;

  async function finalizeSignIn() {
    if ((signIn as any).status === "complete") {
      await (signIn as any).finalize({
        navigate: ({ session, decorateUrl }: { session?: any; decorateUrl: (url: string) => string }) => {
          if (session?.currentTask) {
            console.log("[LoginForm] session task:", session.currentTask);
            return;
          }
          // Always use window.location.replace so the browser sends the Clerk
          // handshake params in the next request, allowing the server middleware
          // to set the session cookie before /api/auth/resolve-redirect is called.
          const url = decorateUrl(redirectAfterAuth);
          window.location.replace(url);
        },
      });
      return true;
    }
    return false;
  }

  async function handleEmailContinue(e: React.FormEvent) {
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
      await (signIn as any).create({ identifier: normalized });

      const factors: Array<{ strategy: string }> = (signIn as any).supportedFirstFactors ?? [];
      const hasPassword = factors.some((f) => f.strategy === "password");

      if (hasPassword) {
        setStep("password");
      } else {
        await (signIn as any).emailCode.sendCode();
        setVerifyMode("emailCode");
        setStep("emailCode");
      }
    } catch (err) {
      console.error("[LoginForm] handleEmailContinue error:", err);
      setError(err instanceof Error ? err.message : "Impossible de continuer. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn || loading) return;

    if (!password) {
      setError("Merci d'entrer ton mot de passe.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // Clerk v7 API: signIn.password() replaces attemptFirstFactor({ strategy: "password" })
      await (signIn as any).password({ emailAddress: normalizeEmail(email), password });

      const status = (signIn as any).status;

      if (status === "complete") {
        const done = await finalizeSignIn();
        if (!done) {
          setError("Connexion incomplète. Réessaie.");
          setLoading(false);
        }
      } else if (status === "needs_client_trust" || status === "needs_second_factor") {
        // Client Trust (new device) or MFA: verify identity via email code
        await (signIn as any).mfa.sendEmailCode();
        setVerifyMode("mfa");
        setStep("emailCode");
        setLoading(false);
      } else {
        setError("Connexion incomplète. Réessaie.");
        setLoading(false);
      }
    } catch (err) {
      console.error("[LoginForm] handlePasswordSubmit error:", err);
      setError(err instanceof Error ? err.message : "Mot de passe incorrect.");
      setLoading(false);
    }
  }

  async function switchToEmailCode() {
    if (!signIn || loading) return;
    setError(null);
    setLoading(true);
    try {
      await (signIn as any).emailCode.sendCode();
      setVerifyMode("emailCode");
      setStep("emailCode");
    } catch (err) {
      console.error("[LoginForm] switchToEmailCode error:", err);
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le code. Réessaie.");
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
      // Use mfa.verifyEmailCode for password+ClientTrust flow, emailCode.verifyCode otherwise
      if (verifyMode === "mfa") {
        await (signIn as any).mfa.verifyEmailCode({ code });
      } else {
        await (signIn as any).emailCode.verifyCode({ code });
      }
      const done = await finalizeSignIn();
      if (!done) {
        setError("Connexion incomplète. Réessaie.");
        setLoading(false);
      }
    } catch (err) {
      console.error("[LoginForm] handleEmailCodeVerify error:", err);
      setError(err instanceof Error ? err.message : "Code invalide.");
      setLoading(false);
    }
  }

  function resetToEmail() {
    setStep("email");
    setPassword("");
    setEmailCode("");
    setVerifyMode("emailCode");
    setError(null);
  }

  async function handleGoogle() {
    if (!signIn || loading) return;

    setError(null);
    setLoading(true);
    try {
      const { error: ssoError } = await (signIn as any).sso({
        strategy: "oauth_google",
        redirectCallbackUrl: "/auth/google",
        redirectUrl: redirectAfterAuth,
      });
      if (ssoError) throw new Error(ssoError.message ?? "Connexion Google impossible.");

      const status = (signIn as any).status;
      if (status === "needs_client_trust") {
        // Clerk's invisible CAPTCHA will resolve via the clerk-captcha div.
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("[LoginForm] handleGoogle error:", err);
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

        {step === "email" && (
          <form onSubmit={handleEmailContinue} className="space-y-5">
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
              {loading ? "Vérification…" : "Continuer"}
            </button>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                Mot de passe
              </label>
              <p className="mt-0.5 text-xs text-slate-500">{email}</p>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={disabled}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={disabled}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => void switchToEmailCode()}
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Utiliser un code par e-mail
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={resetToEmail}
              className="block w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              ← Changer d'e-mail
            </button>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </form>
        )}

        {step === "emailCode" && (
          <form onSubmit={handleEmailCodeVerify} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="email-code">
                Code reçu par e-mail
              </label>
              <input
                id="email-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                disabled={disabled}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="123456"
              />
              <p className="mt-2 text-sm text-slate-600">Un code vient d'être envoyé à {email}. Vérifie ta boîte mail (et les spams).</p>
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
              onClick={resetToEmail}
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Changer d'e-mail
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

      {/* Required by Clerk v7 for bot / client-trust verification (invisible CAPTCHA) */}
      <div id="clerk-captcha" />
    </div>
  );
}
