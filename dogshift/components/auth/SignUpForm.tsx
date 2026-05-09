"use client";

/**
 * Sign-up form using ONLY Clerk v7 documented APIs.
 *
 * Why no `as any` casts here?
 *  - Casts hide silent breakages: if Clerk renames a method (e.g. v6 had
 *    `signUp.verifications.sendEmailCode()`, v7 has `prepareEmailAddressVerification()`),
 *    a typed call breaks at build time. A cast lets the broken call compile and
 *    fail in production.
 *  - All methods used here are part of the public typed surface of @clerk/nextjs
 *    7.x and won't disappear without a major version bump (which we control via
 *    pinned versions in package.json — no caret, no auto-update).
 *  - The Cloudflare Turnstile widget (`#clerk-captcha`) is mounted ONCE for the
 *    entire component lifetime so its token survives email→password→OTP transitions.
 *
 * Steps:
 *  - "email"   → user enters email, we call signUp.create + prepareEmailAddressVerification
 *  - "password" → only shown if Clerk dashboard requires a password (user.requiredFields includes "password");
 *               we call signUp.update({ password }) before showing the OTP step
 *  - "otp"     → user enters the 6-digit code, we call signUp.attemptEmailAddressVerification;
 *               on `complete` we setActive + redirect; on `missing_requirements` with password
 *               missing we fall back to the password step (defense-in-depth)
 *
 * Source: https://clerk.com/docs/references/javascript/sign-up
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
// `@clerk/nextjs/legacy` exports the typed v7 API (`useSignIn`, `useSignUp`
// returning `UseSignInReturn` / `UseSignUpReturn`). The bare
// `@clerk/nextjs` exports point to the new "Future" Signal API (still beta)
// which has a different surface — we stick with the stable typed legacy.
import { useSignUp } from "@clerk/nextjs/legacy";
import { useClerk } from "@clerk/nextjs";
import Link from "next/link";

import { withPublicOrigin } from "@/lib/url/publicOrigin";
import {
  clerkErrorCode,
  clerkErrorMessage,
  sanitizeVerificationCode,
} from "@/lib/auth/clerkErrorMessage";
import { reportApiError } from "@/lib/observability/reportApiError";
import OtpInput from "@/components/auth/OtpInput";

function normalizeEmail(input: string) {
  return input.replace(/\s+/g, "").trim().toLowerCase();
}

const RESEND_COOLDOWN_SECONDS = 30;
const PASSWORD_MIN_LENGTH = 8;

type Step = "email" | "password" | "otp";

export default function SignUpForm() {
  const { signUp, isLoaded, setActive } = useSignUp();
  const clerk = useClerk();
  const searchParams = useSearchParams();

  const next = (searchParams?.get("next") ?? "").trim();
  const redirectAfterAuth = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [oauthInFlight, setOauthInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [resendCooldownLeft, setResendCooldownLeft] = useState(0);

  const formDisabled = !isLoaded || loading || oauthInFlight;
  const googleDisabled = !isLoaded || oauthInFlight;

  /**
   * Decide which step to show next based on Clerk's `requiredFields` /
   * `missingFields`. Centralized so all paths (after create / update / verify)
   * route to the same place.
   */
  function nextStepFrom(resource: { requiredFields: string[]; missingFields: string[] }): Step {
    const stillMissing = resource.missingFields ?? [];
    if (stillMissing.includes("password")) return "password";
    return "otp";
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError("Merci d'entrer une adresse email valide.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const created = await signUp.create({ emailAddress: normalized });
      // Always send the verification code now — we'll show the OTP step after
      // the password step (if any). The code stays valid for 10 minutes.
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setCodeSentAt(Date.now());
      setStep(nextStepFrom(created));
    } catch (err) {
      const code = clerkErrorCode(err);
      if (code === "form_identifier_exists") {
        setError("Un compte existe déjà avec cette adresse e-mail. Connecte-toi plutôt.");
      } else {
        reportApiError({
          kind: "upstream_error",
          code: code ?? "CLERK_SIGN_UP_CREATE_FAILED",
          route: "auth.signup.create",
        });
        setError(clerkErrorMessage(err, "Impossible d'envoyer le code. Réessaie dans un instant."));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp || loading) return;

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const updated = await signUp.update({ password });

      // If Clerk now considers the sign-up complete (rare — usually email
      // still needs verification), finalize directly. Otherwise move to OTP.
      if (updated.status === "complete" && updated.createdSessionId && setActive) {
        await setActive({ session: updated.createdSessionId });
        // Force canonical origin (see LoginForm.finalizeIfComplete) so the
        // session cookie isn't dropped by an apex→www 308 redirect.
        window.location.replace(withPublicOrigin(redirectAfterAuth));
        return;
      }
      setStep(nextStepFrom(updated));
    } catch (err) {
      const code = clerkErrorCode(err);
      reportApiError({
        kind: "upstream_error",
        code: code ?? "CLERK_SIGN_UP_PASSWORD_FAILED",
        route: "auth.signup.password",
      });
      setError(
        clerkErrorMessage(
          err,
          "Mot de passe refusé. Choisis-en un plus complexe (8 caractères minimum, mélange lettres/chiffres).",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function resendEmailCode() {
    if (!isLoaded || !signUp || loading || resendCooldownLeft > 0) return;
    setError(null);
    setLoading(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setEmailCode("");
      setCodeSentAt(Date.now());
    } catch (err) {
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_SIGN_UP_RESEND_CODE_FAILED",
        route: "auth.signup.resend_code",
      });
      setError(
        clerkErrorMessage(err, "Impossible d'envoyer un nouveau code. Réessaie dans un instant."),
      );
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
    if (!isLoaded || !signUp || loading) return;

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
      // Read status from the RETURNED resource — not from the stale `signUp`
      // hook variable which can lag behind by one render and cause a phantom
      // "already verified" loop on retries.
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete" && result.createdSessionId && setActive) {
        await setActive({ session: result.createdSessionId });
        // Force canonical origin (see LoginForm.finalizeIfComplete).
        window.location.replace(withPublicOrigin(redirectAfterAuth));
        return;
      }

      // Email is verified but Clerk needs more (typically: password). This is
      // exactly the case that previously produced a phantom 400 because we
      // re-attempted verification instead of moving forward. Now we route to
      // the right next step.
      if (result.status === "missing_requirements") {
        const target = nextStepFrom(result);
        if (target === "otp") {
          // Should never happen at this point, but be defensive.
          setError("Inscription incomplète : champs manquants : " + result.missingFields.join(", "));
          setLoading(false);
          return;
        }
        setStep(target);
        setLoading(false);
        return;
      }

      setError("Inscription incomplète. Réessaie.");
      setLoading(false);
    } catch (err) {
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_SIGN_UP_VERIFY_FAILED",
        route: "auth.signup.verify_code",
      });
      setError(
        clerkErrorMessage(err, "Code incorrect ou expiré. Demande un nouveau code puis réessaie."),
      );
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!isLoaded || !signUp || oauthInFlight) return;

    setError(null);
    setOauthInFlight(true);
    try {
      try {
        sessionStorage.setItem("ds_oauth_after", redirectAfterAuth);
      } catch {
        /* private mode */
      }
      // `authenticateWithRedirect` is the typed v7 OAuth entry point.
      // It throws on error rather than returning { error } — wrap in try/catch.
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: withPublicOrigin("/auth/google"),
        redirectUrlComplete: withPublicOrigin(redirectAfterAuth),
      });
    } catch (err) {
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_SIGN_UP_GOOGLE_FAILED",
        route: "auth.signup.google",
      });
      setError(clerkErrorMessage(err, "Inscription Google impossible. Réessaie dans un instant."));
      setOauthInFlight(false);
    }
  }

  function resetToEmail() {
    if (loading) return;
    setStep("email");
    setPassword("");
    setEmailCode("");
    setError(null);
    setCodeSentAt(null);
  }

  // Touch `clerk` to keep it in scope for future programmatic access (e.g.
  // sign-out before a fresh sign-up). Avoids dead-code lint warnings without
  // affecting behavior.
  void clerk;

  return (
    <div className="flex flex-col">
      {/* Mounted ONCE for the lifetime of the component so the Cloudflare
          Turnstile widget keeps its token across step transitions. */}
      <div id="clerk-captcha" className="absolute h-0 w-0 overflow-hidden" aria-hidden />

      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">Créer un compte</h1>
      <p className="mt-2 text-center text-sm text-slate-600">Rejoins DogShift dès maintenant.</p>

      <div className="mt-6 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={googleDisabled}
          aria-busy={oauthInFlight}
          className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!isLoaded ? "Chargement…" : oauthInFlight ? "Redirection…" : "S'inscrire avec Google"}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {step === "email" && (
          <form onSubmit={handleEmailSignUp} className="space-y-5">
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
              {loading ? "Envoi…" : "S'inscrire par e-mail"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-slate-700">Choisis un mot de passe</p>
              <p className="text-sm font-semibold text-slate-900">{email}</p>
              <p className="text-xs text-slate-500">8 caractères minimum, sécurisé.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                Mot de passe
              </label>
              <div className="relative mt-2">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={formDisabled}
                  minLength={PASSWORD_MIN_LENGTH}
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
              disabled={formDisabled || password.length < PASSWORD_MIN_LENGTH}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Enregistrement…" : "Continuer"}
            </button>

            <button
              type="button"
              disabled={formDisabled}
              onClick={resetToEmail}
              className="block w-full text-center text-sm text-slate-400 hover:text-slate-600 transition"
            >
              ← Changer d&apos;adresse e-mail
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleEmailCodeVerify} className="space-y-6">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-slate-700">Code envoyé à</p>
              <p className="text-sm font-semibold text-slate-900">{email}</p>
              <p className="text-xs text-slate-500">Vérifie ta boîte mail (et les spams) — valable 10 minutes.</p>
            </div>

            <div className="space-y-3">
              <OtpInput value={emailCode} onChange={setEmailCode} disabled={formDisabled} />
              {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
            </div>

            <button
              type="submit"
              disabled={formDisabled || emailCode.length < 6}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Vérification…" : "Valider le code"}
            </button>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={formDisabled || resendCooldownLeft > 0}
                onClick={() => void resendEmailCode()}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 transition"
              >
                {resendCooldownLeft > 0
                  ? `Renvoyer un code dans ${resendCooldownLeft}s`
                  : "Renvoyer un nouveau code"}
              </button>

              <button
                type="button"
                disabled={formDisabled}
                onClick={resetToEmail}
                className="text-sm text-slate-400 hover:text-slate-600 transition"
              >
                ← Changer d&apos;adresse e-mail
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-8 text-center text-sm text-slate-600">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-semibold text-slate-900 hover:underline underline-offset-2">
          Se connecter
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
