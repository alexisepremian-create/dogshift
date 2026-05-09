"use client";

/**
 * Login form using ONLY Clerk v7 documented APIs.
 *
 * Why no `as any` casts here?
 *  - The previous version used `signIn.password()`, `signIn.emailCode.sendCode()`,
 *    `signIn.mfa.sendEmailCode()`, `signIn.finalize()` — methods that are NOT
 *    on the Clerk v7 typed surface. They worked through a compat layer that
 *    can disappear at any patch release without warning.
 *  - This file uses ONLY the typed v7 API:
 *      signIn.create, prepareFirstFactor, attemptFirstFactor,
 *      prepareSecondFactor, attemptSecondFactor,
 *      authenticateWithRedirect (OAuth),
 *      setActive (from useClerk).
 *    If Clerk renames any of these in v8, the build fails — no silent prod bug.
 *
 * Source: https://clerk.com/docs/references/javascript/sign-in
 */

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
// `@clerk/nextjs/legacy` exports the typed v7 API (`useSignIn`, `useSignUp`
// returning `UseSignInReturn` / `UseSignUpReturn`). The bare
// `@clerk/nextjs` exports point to the new "Future" Signal API (still beta)
// which has a different surface — we stick with the stable typed legacy.
import { useSignIn } from "@clerk/nextjs/legacy";
import { useClerk, useUser } from "@clerk/nextjs";
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
type VerifyMode = "firstFactor" | "secondFactor";

const RESEND_COOLDOWN_SECONDS = 30;

export default function LoginForm() {
  const { signIn, isLoaded, setActive } = useSignIn();
  const clerk = useClerk();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const next = (searchParams?.get("next") ?? "").trim();
  const startGoogle = (searchParams?.get("startGoogle") ?? "").trim();
  const startGoogleMode = startGoogle === "1" || startGoogle.toLowerCase() === "true";
  const redirectAfterAuth = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [verifyMode, setVerifyMode] = useState<VerifyMode>("firstFactor");
  /** Cached id of the email factor returned by `signIn.create()` — needed to
   *  call `prepareFirstFactor({ strategy: "email_code", emailAddressId })`. */
  const [emailFactorId, setEmailFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [resendCooldownLeft, setResendCooldownLeft] = useState(0);
  const [oauthInFlight, setOauthInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoGoogleStarted, setAutoGoogleStarted] = useState(false);

  const formDisabled = !isLoaded || loading || oauthInFlight;
  const googleDisabled = !isLoaded || oauthInFlight;

  /** After any signIn.attempt* call, drive the next step from the resource's
   *  status. Centralized so all paths (password, email-code, MFA) finalize the
   *  same way. Returns true when the session is fully active. */
  async function finalizeIfComplete(
    result: { status: string | null; createdSessionId: string | null },
  ): Promise<boolean> {
    if (result.status === "complete" && result.createdSessionId && setActive) {
      await setActive({ session: result.createdSessionId });
      // window.location.replace ensures the browser sends Clerk handshake
      // params on the next request so middleware can set the session cookie
      // before /api/auth/resolve-redirect runs server-side.
      window.location.replace(redirectAfterAuth);
      return true;
    }
    return false;
  }

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError("Merci d'entrer une adresse email valide.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: normalized });

      const factors = result.supportedFirstFactors ?? [];
      const passwordFactor = factors.find((f) => f.strategy === "password");
      const emailFactor = factors.find((f) => f.strategy === "email_code");

      if (passwordFactor) {
        setStep("password");
        return;
      }

      if (!emailFactor || !("emailAddressId" in emailFactor)) {
        setError("Aucune méthode de connexion disponible pour ce compte.");
        return;
      }

      setEmailFactorId(emailFactor.emailAddressId);
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId,
      });
      setVerifyMode("firstFactor");
      setStep("emailCode");
      setCodeSentAt(Date.now());
    } catch (err) {
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
    if (!isLoaded || !signIn || loading) return;

    if (!password) {
      setError("Merci d'entrer ton mot de passe.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: "password", password });

      if (await finalizeIfComplete(result)) return;

      if (result.status === "needs_second_factor") {
        const factors = result.supportedSecondFactors ?? [];
        const emailMfa = factors.find((f) => f.strategy === "email_code");

        if (emailMfa && "emailAddressId" in emailMfa) {
          await signIn.prepareSecondFactor({
            strategy: "email_code",
            emailAddressId: emailMfa.emailAddressId,
          });
          setVerifyMode("secondFactor");
          setStep("emailCode");
          setCodeSentAt(Date.now());
          setLoading(false);
          return;
        }
        setError("Méthode de second facteur non supportée. Contacte le support.");
        setLoading(false);
        return;
      }

      setError("Connexion incomplète. Réessaie.");
      setLoading(false);
    } catch (err) {
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
    if (!isLoaded || !signIn || loading) return;
    setError(null);
    setLoading(true);
    try {
      // Look up the email factor on the live signIn resource (state from
      // handleEmailContinue may be stale if the user backed out).
      const factors = signIn.supportedFirstFactors ?? [];
      const emailFactor = factors.find((f) => f.strategy === "email_code");
      if (!emailFactor || !("emailAddressId" in emailFactor)) {
        setError("Méthode de connexion par e-mail non disponible.");
        return;
      }
      setEmailFactorId(emailFactor.emailAddressId);
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId,
      });
      setVerifyMode("firstFactor");
      setStep("emailCode");
      setCodeSentAt(Date.now());
    } catch (err) {
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

  async function resendEmailCode() {
    if (!isLoaded || !signIn || loading || resendCooldownLeft > 0) return;
    setError(null);
    setLoading(true);
    try {
      if (verifyMode === "secondFactor") {
        const factors = signIn.supportedSecondFactors ?? [];
        const emailMfa = factors.find((f) => f.strategy === "email_code");
        if (!emailMfa || !("emailAddressId" in emailMfa)) {
          throw new Error("MFA email factor unavailable");
        }
        await signIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId: emailMfa.emailAddressId,
        });
      } else {
        const factorId =
          emailFactorId ??
          (signIn.supportedFirstFactors ?? []).find((f) => f.strategy === "email_code" && "emailAddressId" in f)?.emailAddressId;
        if (!factorId) throw new Error("Email first factor unavailable");
        await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: factorId });
      }
      setEmailCode("");
      setCodeSentAt(Date.now());
    } catch (err) {
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

  useEffect(() => {
    if (!codeSentAt) {
      setResendCooldownLeft(0);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - codeSentAt) / 1000);
      setResendCooldownLeft(Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [codeSentAt]);

  async function handleEmailCodeVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn || loading) return;

    const code = sanitizeVerificationCode(emailCode);
    if (!code) {
      setError("Merci d'entrer le code reçu par e-mail.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result =
        verifyMode === "secondFactor"
          ? await signIn.attemptSecondFactor({ strategy: "email_code", code })
          : await signIn.attemptFirstFactor({ strategy: "email_code", code });

      if (await finalizeIfComplete(result)) return;

      setError("Connexion incomplète. Réessaie.");
      setLoading(false);
    } catch (err) {
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_EMAIL_CODE_VERIFY_FAILED",
        route: "auth.login.verify_code",
      });
      setError(
        clerkErrorMessage(err, "Code incorrect ou expiré. Demande un nouveau code puis réessaie."),
      );
      setLoading(false);
    }
  }

  function resetToEmail() {
    setStep("email");
    setPassword("");
    setEmailCode("");
    setVerifyMode("firstFactor");
    setEmailFactorId(null);
    setError(null);
  }

  async function handleGoogle() {
    if (!isLoaded || !signIn || oauthInFlight) return;

    setError(null);
    setOauthInFlight(true);
    try {
      try {
        sessionStorage.setItem("ds_oauth_after", redirectAfterAuth);
      } catch {
        /* private mode */
      }
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: withPublicOrigin("/auth/google"),
        redirectUrlComplete: withPublicOrigin(redirectAfterAuth),
      });
    } catch (err) {
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
    if (!isLoaded || !signIn) return;
    if (!userLoaded) return;
    if (isSignedIn) return;
    setAutoGoogleStarted(true);
    void handleGoogle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGoogleStarted, isLoaded, signIn, startGoogleMode, userLoaded, isSignedIn]);

  // Touch `clerk` and `router` so they remain in scope for any future
  // programmatic auth calls. No runtime impact.
  void clerk;
  void router;

  return (
    <div className="flex flex-col">
      {/* Mounted ONCE for the lifetime of the component so the Cloudflare
          Turnstile widget keeps its token. Used for client-trust verification
          on suspicious sign-ins. */}
      <div id="clerk-captcha" className="absolute h-0 w-0 overflow-hidden" aria-hidden />

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
          {!isLoaded ? "Chargement…" : oauthInFlight ? "Redirection…" : "Continuer avec Google"}
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
              <div className="relative mt-2">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={formDisabled}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={formDisabled}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
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
    </div>
  );
}
