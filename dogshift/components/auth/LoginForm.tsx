"use client";

// Clerk's runtime API is richer than its exported TS types (mfa.sendEmailCode,
// legacySignIn access via `clerk.client`, dynamic strategies, etc.), so we
// intentionally cast to `any` in a few spots — disable that rule here rather
// than peppering the file with per-line comments.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useClerk, useSignIn, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { withPublicOrigin } from "@/lib/url/publicOrigin";
import {
  clerkErrorCode,
  clerkErrorMessage,
  sanitizeVerificationCode,
} from "@/lib/auth/clerkErrorMessage";
import { reportApiError } from "@/lib/observability/reportApiError";

function normalizeEmail(input: string) {
  return input.replace(/\s+/g, "").trim().toLowerCase();
}

type Step = "email" | "password" | "emailCode";
type VerifyMode = "emailCode" | "mfa";

export default function LoginForm() {
  const clerk = useClerk();
  const { signIn, fetchStatus } = useSignIn();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  // `router` and `forceMode` are kept on purpose: they're part of the signIn
  // contract we may reuse as the flow grows (e.g. programmatic redirects,
  // "force re-auth" support already exposed as a query string).
  useRouter();

  const next = (searchParams?.get("next") ?? "").trim();
  const startGoogle = (searchParams?.get("startGoogle") ?? "").trim();
  const startGoogleMode = startGoogle === "1" || startGoogle.toLowerCase() === "true";
  const redirectAfterAuth = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [verifyMode, setVerifyMode] = useState<VerifyMode>("emailCode");
  const [loading, setLoading] = useState(false);
  /** Tracks when the last email-code was sent, so we can show a "renvoyer" button
   *  with a reasonable cooldown (Clerk rate-limits back-to-back sends). */
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [resendCooldownLeft, setResendCooldownLeft] = useState(0);
  /** Google OAuth: must not reuse `loading` — successful sso() often returns before navigation, and we never cleared `loading`, which disabled the whole form ("Vérification…"). */
  const [oauthInFlight, setOauthInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoGoogleStarted, setAutoGoogleStarted] = useState(false);

  const fetching = fetchStatus === "fetching";
  /** Clerk v7 `useSignIn` has no `isLoaded`; `signIn` is null until the client is ready. */
  const signInReady = !!signIn;
  /** Email / password / code steps — can wait on Clerk fetch. */
  const formDisabled = !signInReady || fetching || loading || oauthInFlight;
  /** Google: do not tie to `fetching` / email `loading` so the button stays clickable when those get stuck. */
  const googleDisabled = !signInReady || oauthInFlight;

  async function finalizeSignIn(): Promise<{ done: boolean; error?: string }> {
    if ((signIn as any).status === "complete") {
      const { error: finalizeError } = await (signIn as any).finalize({
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
      if (finalizeError) {
        return { done: false, error: clerkErrorMessage(finalizeError, "Connexion incomplète. Réessaie.") };
      }
      return { done: true };
    }
    return { done: false };
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
      const { error: createError } = await (signIn as any).create({ identifier: normalized });
      if (createError) throw createError;

      const factors: Array<{ strategy: string }> = (signIn as any).supportedFirstFactors ?? [];
      const hasPassword = factors.some((f) => f.strategy === "password");

      if (hasPassword) {
        setStep("password");
      } else {
        const { error: sendError } = await (signIn as any).emailCode.sendCode();
        if (sendError) throw sendError;
        setVerifyMode("emailCode");
        setStep("emailCode");
        setCodeSentAt(Date.now());
      }
    } catch (err) {
      console.error("[LoginForm] handleEmailContinue error:", err);
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_SIGN_IN_CREATE_FAILED",
        route: "auth.login.email_continue",
      });
      setError(clerkErrorMessage(err, "Impossible de continuer. Réessaie dans un instant."));
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
      const { error: passwordError } = await (signIn as any).password({ emailAddress: normalizeEmail(email), password });
      if (passwordError) throw passwordError;

      const status = (signIn as any).status;

      if (status === "complete") {
        const { done, error: finalizeMsg } = await finalizeSignIn();
        if (!done) {
          setError(finalizeMsg ?? "Connexion incomplète. Réessaie.");
          setLoading(false);
        }
      } else if (status === "needs_client_trust" || status === "needs_second_factor") {
        // Client Trust (new device) or MFA: verify identity via email code
        const { error: mfaSendError } = await (signIn as any).mfa.sendEmailCode();
        if (mfaSendError) throw mfaSendError;
        setVerifyMode("mfa");
        setStep("emailCode");
        setCodeSentAt(Date.now());
        setLoading(false);
      } else {
        setError("Connexion incomplète. Réessaie.");
        setLoading(false);
      }
    } catch (err) {
      console.error("[LoginForm] handlePasswordSubmit error:", err);
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_PASSWORD_SUBMIT_FAILED",
        route: "auth.login.password",
      });
      setError(clerkErrorMessage(err, "Mot de passe incorrect."));
      setLoading(false);
    }
  }

  async function switchToEmailCode() {
    if (!signIn || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { error: sendError } = await (signIn as any).emailCode.sendCode();
      if (sendError) throw sendError;
      setVerifyMode("emailCode");
      setStep("emailCode");
      setCodeSentAt(Date.now());
    } catch (err) {
      console.error("[LoginForm] switchToEmailCode error:", err);
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_SEND_CODE_FAILED",
        route: "auth.login.send_code",
      });
      setError(clerkErrorMessage(err, "Impossible d'envoyer le code. Réessaie dans un instant."));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Resends the email code on the current step. Used by the "Renvoyer un code"
   * button on the emailCode screen — the #1 fix for users stuck on expired
   * codes / old codes lingering in their inbox.
   */
  async function resendEmailCode() {
    if (!signIn || loading) return;
    if (resendCooldownLeft > 0) return;
    setError(null);
    setLoading(true);
    try {
      if (verifyMode === "mfa") {
        const { error: resendError } = await (signIn as any).mfa.sendEmailCode();
        if (resendError) throw resendError;
      } else {
        const { error: resendError } = await (signIn as any).emailCode.sendCode();
        if (resendError) throw resendError;
      }
      setEmailCode("");
      setCodeSentAt(Date.now());
    } catch (err) {
      console.error("[LoginForm] resendEmailCode error:", err);
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_RESEND_CODE_FAILED",
        route: "auth.login.resend_code",
      });
      setError(clerkErrorMessage(err, "Impossible d'envoyer un nouveau code. Réessaie dans un instant."));
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailCodeVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn || loading) return;

    // Strip every non-digit character — invisible whitespace from Gmail/Outlook
    // copy-paste is the #1 cause of "code invalide" bug reports.
    const code = sanitizeVerificationCode(emailCode);
    if (!code) {
      setError("Merci d'entrer le code reçu par e-mail.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // Use mfa.verifyEmailCode for password+ClientTrust flow, emailCode.verifyCode otherwise
      if (verifyMode === "mfa") {
        const { error: verifyError } = await (signIn as any).mfa.verifyEmailCode({ code });
        if (verifyError) throw verifyError;
      } else {
        const { error: verifyError } = await (signIn as any).emailCode.verifyCode({ code });
        if (verifyError) throw verifyError;
      }
      const { done, error: finalizeMsg } = await finalizeSignIn();
      if (!done) {
        setError(finalizeMsg ?? "Connexion incomplète. Réessaie.");
        setLoading(false);
      }
    } catch (err) {
      console.error("[LoginForm] handleEmailCodeVerify error:", err);
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_EMAIL_CODE_VERIFY_FAILED",
        route: "auth.login.verify_code",
      });
      setError(
        clerkErrorMessage(
          err,
          "Code incorrect ou expiré. Demande un nouveau code puis réessaie.",
        ),
      );
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
    if (!signIn || oauthInFlight) return;

    setError(null);
    setOauthInFlight(true);
    try {
      try {
        sessionStorage.setItem("ds_oauth_after", redirectAfterAuth);
      } catch {
        /* private mode */
      }
      const legacySignIn = (clerk as any)?.client?.signIn;
      if (legacySignIn && typeof legacySignIn.authenticateWithRedirect === "function") {
        await legacySignIn.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: withPublicOrigin("/auth/google"),
          redirectUrlComplete: withPublicOrigin(redirectAfterAuth),
        });
      } else {
        const { error: ssoError } = await (signIn as any).sso({
          strategy: "oauth_google",
          redirectCallbackUrl: withPublicOrigin("/auth/google"),
          redirectUrl: withPublicOrigin(redirectAfterAuth),
        });
        if (ssoError) throw new Error(ssoError.message ?? "Connexion Google impossible.");
      }
    } catch (err) {
      console.error("[LoginForm] handleGoogle error:", err);
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_GOOGLE_OAUTH_FAILED",
        route: "auth.login.google",
      });
      setError(clerkErrorMessage(err, "Connexion Google impossible. Réessaie dans un instant."));
      setOauthInFlight(false);
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

  // Countdown for the "Renvoyer un code" button (Clerk rate-limits ~30s between sends).
  const RESEND_COOLDOWN_SECONDS = 30;
  useEffect(() => {
    if (!codeSentAt) {
      setResendCooldownLeft(0);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - codeSentAt) / 1000);
      const left = Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed);
      setResendCooldownLeft(left);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [codeSentAt]);

  return (
    <div className="flex flex-col">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">S&apos;identifier</h1>
      <p className="mt-2 text-center text-sm text-slate-600">Accède à ton espace DogShift.</p>

      <div className="mt-6 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={googleDisabled}
          aria-busy={oauthInFlight}
          className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!signInReady ? "Chargement…" : oauthInFlight ? "Redirection…" : "Continuer avec Google"}
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
                disabled={formDisabled}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="toi@exemple.com"
              />
              {error ? <p className="mt-2 text-center text-sm text-rose-600">{error}</p> : null}
            </div>

            <button
              type="submit"
              disabled={formDisabled}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Vérification…" : "Continuer"}
            </button>
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
                disabled={formDisabled}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="••••••••"
              />
              {error ? <p className="mt-2 text-center text-sm text-rose-600">{error}</p> : null}
            </div>

            <button
              type="submit"
              disabled={formDisabled}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>

            <button
              type="button"
              disabled={formDisabled}
              onClick={() => void switchToEmailCode()}
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Utiliser un code par e-mail
            </button>

            <button
              type="button"
              disabled={formDisabled}
              onClick={resetToEmail}
              className="block w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              ← Changer d&apos;e-mail
            </button>
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
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoFocus
                value={emailCode}
                onChange={(e) => setEmailCode(sanitizeVerificationCode(e.target.value))}
                disabled={formDisabled}
                maxLength={6}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base tracking-[0.3em] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="123456"
              />
              <p className="mt-2 text-sm text-slate-600">
                Un code à 6 chiffres a été envoyé à <span className="font-medium text-slate-800">{email}</span>. Vérifie ta boîte mail (et les spams) — il reste valable 10 minutes.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Si tu as déjà demandé plusieurs codes, seul le dernier fonctionne.
              </p>
              {error ? <p className="mt-2 text-center text-sm text-rose-600">{error}</p> : null}
            </div>

            <button
              type="submit"
              disabled={formDisabled}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Vérification…" : "Valider le code"}
            </button>

            <button
              type="button"
              disabled={formDisabled || resendCooldownLeft > 0}
              onClick={() => void resendEmailCode()}
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendCooldownLeft > 0
                ? `Renvoyer un code (${resendCooldownLeft}s)`
                : "Renvoyer un nouveau code"}
            </button>

            <button
              type="button"
              disabled={formDisabled}
              onClick={resetToEmail}
              className="block w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              ← Changer d&apos;e-mail
            </button>
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
          conditions d&apos;utilisation
        </Link>
        .
      </p>

      {/* Required by Clerk v7 for bot / client-trust verification (invisible CAPTCHA) */}
      <div id="clerk-captcha" />
    </div>
  );
}
