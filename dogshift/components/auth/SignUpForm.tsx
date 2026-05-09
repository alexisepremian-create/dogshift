"use client";

// Clerk's runtime API is richer than its exported TS types (resendEmailCode,
// legacySignUp access, dynamic `.sso` vs `.authenticateWithRedirect`, etc.),
// so we intentionally cast to `any` in a few spots — disable that rule here
// rather than peppering the file with per-line comments.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useClerk, useSignUp } from "@clerk/nextjs";
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

export default function SignUpForm() {
  const clerk = useClerk();
  const { signUp, fetchStatus } = useSignUp();
  const { setActive } = useClerk() as any;
  const searchParams = useSearchParams();
  const router = useRouter();

  const next = (searchParams?.get("next") ?? "").trim();
  const redirectAfterAuth = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthInFlight, setOauthInFlight] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Tracks when the last email-code was sent, so we can show a "renvoyer" button
   *  with a reasonable cooldown (Clerk rate-limits back-to-back sends). */
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [resendCooldownLeft, setResendCooldownLeft] = useState(0);

  const fetching = fetchStatus === "fetching";
  const signUpReady = !!signUp;
  const formDisabled = !signUpReady || fetching || loading || oauthInFlight;
  const googleDisabled = !signUpReady || oauthInFlight;

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError("Merci d'entrer une adresse email valide.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await (signUp as any).create({ emailAddress: normalized });
      await (signUp as any).prepareEmailAddressVerification({ strategy: "email_code" });
      setSent(true);
      setCodeSentAt(Date.now());
    } catch (err) {
      const code = clerkErrorCode(err);
      const isAlreadyExists = code === "form_identifier_exists";
      if (isAlreadyExists) {
        setError("Un compte existe déjà avec cette adresse e-mail. Connecte-toi plutôt.");
      } else {
        reportApiError({
          kind: "upstream_error",
          code: code ?? "CLERK_SIGN_UP_CREATE_FAILED",
          route: "auth.signup.create",
        });
        setError(
          clerkErrorMessage(
            err,
            "Impossible d'envoyer le code. Réessaie dans un instant.",
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  /** Resends the verification email code. Shown as a button on the code step
   *  — the #1 fix for users stuck on expired or lost codes. */
  async function resendEmailCode() {
    if (!signUp || loading) return;
    if (resendCooldownLeft > 0) return;
    setError(null);
    setLoading(true);
    try {
      await (signUp as any).prepareEmailAddressVerification({ strategy: "email_code" });
      setEmailCode("");
      setCodeSentAt(Date.now());
    } catch (err) {
      console.error("[SignUpForm] resendEmailCode error:", err);
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_SIGN_UP_RESEND_CODE_FAILED",
        route: "auth.signup.resend_code",
      });
      setError(
        clerkErrorMessage(
          err,
          "Impossible d'envoyer un nouveau code. Réessaie dans un instant.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

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

  async function handleEmailCodeVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp || loading) return;

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
      // Use the standard Clerk v7 API and read status from the RETURNED value
      // (not from the stale `signUp` hook variable, which causes "already verified" loops).
      const result = await (signUp as any).attemptEmailAddressVerification({ code });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace(redirectAfterAuth);
        return;
      }

      setError("Inscription incomplète. Réessaie.");
      setLoading(false);
    } catch (err) {
      console.error("[SignUpForm] handleEmailCodeVerify error:", err);
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_SIGN_UP_VERIFY_FAILED",
        route: "auth.signup.verify_code",
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

  async function handleGoogle() {
    if (!signUp || oauthInFlight) return;

    setError(null);
    setOauthInFlight(true);
    try {
      try {
        sessionStorage.setItem("ds_oauth_after", redirectAfterAuth);
      } catch {
        /* private mode */
      }
      const legacySignUp = (clerk as any)?.client?.signUp;
      if (legacySignUp && typeof legacySignUp.authenticateWithRedirect === "function") {
        await legacySignUp.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: withPublicOrigin("/auth/google"),
          redirectUrlComplete: withPublicOrigin(redirectAfterAuth),
        });
      } else {
        const { error: ssoError } = await (signUp as any).sso({
          strategy: "oauth_google",
          redirectCallbackUrl: withPublicOrigin("/auth/google"),
          redirectUrl: withPublicOrigin(redirectAfterAuth),
        });
        if (ssoError) throw new Error(ssoError.message ?? "Inscription Google impossible.");
      }
    } catch (err) {
      console.error("[SignUpForm] handleGoogle error:", err);
      reportApiError({
        kind: "upstream_error",
        code: clerkErrorCode(err) ?? "CLERK_SIGN_UP_GOOGLE_FAILED",
        route: "auth.signup.google",
      });
      setError(
        clerkErrorMessage(
          err,
          "Inscription Google impossible. Réessaie dans un instant.",
        ),
      );
      setOauthInFlight(false);
    }
  }

  return (
    <div className="flex flex-col">
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
          {!signUpReady ? "Chargement…" : oauthInFlight ? "Redirection…" : "S'inscrire avec Google"}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {!sent ? (
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

            {/* Required by Clerk v7 for bot protection */}
            <div id="clerk-captcha" />

            <button
              type="submit"
              disabled={formDisabled}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Envoi…" : "S'inscrire par e-mail"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailCodeVerify} className="space-y-6">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-slate-700">Code envoyé à</p>
              <p className="text-sm font-semibold text-slate-900">{email}</p>
              <p className="text-xs text-slate-500">Vérifie ta boîte mail (et les spams) — valable 10 minutes.</p>
            </div>

            <div className="space-y-3">
              <OtpInput
                value={emailCode}
                onChange={setEmailCode}
                disabled={formDisabled}
              />
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
                onClick={() => {
                  if (loading) return;
                  setSent(false);
                  setEmailCode("");
                  setError(null);
                  setCodeSentAt(null);
                }}
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
