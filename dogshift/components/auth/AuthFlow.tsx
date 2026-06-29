"use client";

/**
 * Unified email-first auth flow — Auth.js v5 (Credentials + Google).
 *
 * One component for BOTH /login and /signup, so the two screens are identical
 * (Airbnb-style "Connexion ou inscription"). The user enters their email first;
 * we probe `/api/auth/check-email` and branch:
 *
 *   email step  → enter email + Google + Continue
 *   login step  → existing account → password + "forgot password" → signIn
 *   signup step → new account → optional name + single password → register
 *
 * Design notes:
 *  - No owner/sitter selector at signup (everyone is OWNER; sitter onboarding
 *    happens later via /become-sitter). The register endpoint ignores intent.
 *  - No "confirm password" field — the show/hide eye covers typos.
 *  - Terms acceptance is passive ("En continuant, tu acceptes…"), not a
 *    blocking checkbox.
 *  - Primary buttons use aria-disabled + early-return + touch-action:manipulation
 *    (NOT `disabled`) — a real `disabled` swallows the first tap in the iOS
 *    WKWebView / Capacitor shell (recurring native bug).
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

import { reportApiError } from "@/lib/observability/reportApiError";
import { decideAuthStep, type AuthStep } from "@/lib/auth/decideAuthStep";
import { useIsNativeApp } from "@/lib/native/useIsNativeApp";
import { beginAuthTransition, endAuthTransition } from "@/lib/native/authTransition";

function normalizeEmail(input: string) {
  return input.replace(/\s+/g, "").trim().toLowerCase();
}

function passwordIsStrong(pw: string): boolean {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
}

type Step = AuthStep;

const INPUT_CLASS =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200";

const PRIMARY_BTN_CLASS =
  "inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

export default function AuthFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const next = (searchParams?.get("next") ?? "").trim();
  const startGoogle = (searchParams?.get("startGoogle") ?? "").trim();
  const startGoogleMode = startGoogle === "1" || startGoogle.toLowerCase() === "true";
  const resetOk = searchParams?.get("reset") === "ok";
  const callbackUrl = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [noPassword, setNoPassword] = useState(false); // existing account, Google-only

  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthInFlight, setOauthInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoGoogleStarted, setAutoGoogleStarted] = useState(false);

  const isNative = useIsNativeApp();
  const busy = checking || loading || oauthInFlight;

  // Native Google Sign-In. Google blocks OAuth in embedded WebViews
  // (`disallowed_useragent`), so inside the Capacitor app we use the native SDK
  // (@capgo/capacitor-social-login) to get a Google ID token, then bridge it to
  // the "google-native" Auth.js provider which verifies it server-side.
  async function handleGoogleNative() {
    setError(null);
    setOauthInFlight(true);
    try {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      // Trim defensively: a trailing space/newline pasted into the env var makes
      // the SDK derive a callback scheme that doesn't match the (clean) one in
      // Info.plist → "Your app is missing support for the following URL schemes".
      const iosClientId = (process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "").trim();
      const webClientId = (process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "").trim();
      await SocialLogin.initialize({
        google: {
          iOSClientId: iosClientId || undefined,
          iOSServerClientId: webClientId || undefined,
        },
      });
      const res = await SocialLogin.login({
        provider: "google",
        options: { scopes: ["email", "profile"] },
      });
      const idToken = (res?.result as { idToken?: string | null } | undefined)?.idToken ?? null;
      if (!idToken) {
        setError("Connexion Google impossible. Réessaie.");
        setOauthInFlight(false);
        return;
      }
      // Cover the signIn round-trip with the branded splash the instant the
      // native sheet closes — otherwise /login flashes back while signIn()
      // verifies the token server-side. Ended if signIn fails (below).
      if (isNative) beginAuthTransition();
      const signRes = await signIn("google-native", { idToken, redirect: false });
      if (!signRes || signRes.error) {
        if (isNative) endAuthTransition();
        setError("Connexion Google impossible. Réessaie.");
        setOauthInFlight(false);
        return;
      }
      router.replace(callbackUrl);
    } catch (err) {
      // User dismissed the Google sheet → not an error worth surfacing loudly.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cancel|dismiss/i.test(msg)) {
        reportApiError({
          kind: "upstream_error",
          code: "GOOGLE_NATIVE_FAILED",
          route: "auth.flow.google-native",
          extra: { message: msg },
        });
        setError("Connexion Google impossible. Réessaie dans un instant.");
      }
      setOauthInFlight(false);
    }
  }

  async function handleGoogle() {
    if (oauthInFlight) return;
    if (isNative) {
      await handleGoogleNative();
      return;
    }
    setError(null);
    setOauthInFlight(true);
    try {
      await signIn("google", { callbackUrl, redirect: true });
    } catch (err) {
      reportApiError({
        kind: "upstream_error",
        code: "GOOGLE_OAUTH_FAILED",
        route: "auth.flow.google",
      });
      setError("Connexion Google impossible. Réessaie dans un instant.");
      setOauthInFlight(false);
      void err;
    }
  }

  // Native Sign in with Apple — same WebView-block rationale as Google. Uses the
  // native ASAuthorization sheet, gets an Apple identity token, bridges it to
  // the "apple-native" Auth.js provider.
  async function handleAppleNative() {
    setError(null);
    setOauthInFlight(true);
    try {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      await SocialLogin.initialize({});
      const res = await SocialLogin.login({
        provider: "apple",
        options: { scopes: ["email", "name"] },
      });
      const idToken = (res?.result as { idToken?: string | null } | undefined)?.idToken ?? null;
      if (!idToken) {
        setError("Connexion Apple impossible. Réessaie.");
        setOauthInFlight(false);
        return;
      }
      // Cover the signIn round-trip with the branded splash the instant the
      // native sheet closes — otherwise /login flashes back while signIn()
      // verifies the token server-side. Ended if signIn fails (below).
      if (isNative) beginAuthTransition();
      const signRes = await signIn("apple-native", { idToken, redirect: false });
      if (!signRes || signRes.error) {
        if (isNative) endAuthTransition();
        setError("Connexion Apple impossible. Réessaie.");
        setOauthInFlight(false);
        return;
      }
      router.replace(callbackUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/cancel|dismiss/i.test(msg)) {
        reportApiError({
          kind: "upstream_error",
          code: "APPLE_NATIVE_FAILED",
          route: "auth.flow.apple-native",
          extra: { message: msg },
        });
        setError("Connexion Apple impossible. Réessaie dans un instant.");
      }
      setOauthInFlight(false);
    }
  }

  async function handleApple() {
    if (oauthInFlight) return;
    if (isNative) {
      await handleAppleNative();
      return;
    }
    setError(null);
    setOauthInFlight(true);
    try {
      await signIn("apple", { callbackUrl, redirect: true });
    } catch (err) {
      reportApiError({
        kind: "upstream_error",
        code: "APPLE_OAUTH_FAILED",
        route: "auth.flow.apple",
      });
      setError("Connexion Apple impossible. Réessaie dans un instant.");
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

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes("@")) {
      setError("Merci d'entrer une adresse email valide.");
      return;
    }

    setError(null);
    setChecking(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        exists?: boolean;
        hasPassword?: boolean;
      };

      if (!res.ok || !body.ok) {
        setError("Impossible de continuer pour l'instant. Réessaie dans un instant.");
        setChecking(false);
        return;
      }

      const exists = !!body.exists;
      const hasPassword = !!body.hasPassword;
      setEmail(normalized);
      setNoPassword(exists && !hasPassword);
      setStep(decideAuthStep({ exists, hasPassword }));
      setChecking(false);
    } catch (err) {
      reportApiError({
        kind: "internal_error",
        code: "CHECK_EMAIL_EXCEPTION",
        route: "auth.flow.check-email",
        extra: { message: err instanceof Error ? err.message : String(err) },
      });
      setError("Une erreur est survenue. Réessaie dans un instant.");
      setChecking(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setError("Merci d'entrer ton mot de passe.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!res) {
        setError("Connexion impossible pour l'instant. Réessaie dans un instant.");
        setLoading(false);
        return;
      }

      if (res.error) {
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
          route: "auth.flow.login",
        });
        setLoading(false);
        return;
      }

      if (isNative) beginAuthTransition();
      router.replace(callbackUrl);
    } catch (err) {
      reportApiError({
        kind: "internal_error",
        code: "LOGIN_EXCEPTION",
        route: "auth.flow.login",
        extra: { message: err instanceof Error ? err.message : String(err) },
      });
      setError("Une erreur est survenue. Réessaie dans un instant.");
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!passwordIsStrong(password)) {
      setError(
        "Mot de passe trop faible : 8 caractères minimum, avec au moins une majuscule et un chiffre.",
      );
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim() || null,
        }),
      });
      const body = (await registerRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!registerRes.ok || !body.ok) {
        if (body.error === "EMAIL_ALREADY_REGISTERED") {
          // Race: the account got a password between check-email and now.
          setStep("login");
          setError("Un compte existe déjà pour cet email. Entre ton mot de passe pour te connecter.");
        } else if (body.error === "WEAK_PASSWORD") {
          setError("Mot de passe trop faible : 8 caractères, avec majuscule et chiffre.");
        } else {
          setError("Inscription impossible. Réessaie dans un instant.");
        }
        setLoading(false);
        return;
      }

      const loginRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!loginRes || loginRes.error) {
        router.replace("/login?registered=1");
        return;
      }

      if (isNative) beginAuthTransition();
      router.replace(callbackUrl);
    } catch (err) {
      reportApiError({
        kind: "internal_error",
        code: "SIGNUP_EXCEPTION",
        route: "auth.flow.signup",
        extra: { message: err instanceof Error ? err.message : String(err) },
      });
      setError("Une erreur est survenue. Réessaie dans un instant.");
      setLoading(false);
    }
  }

  function backToEmail() {
    setStep("email");
    setPassword("");
    setNoPassword(false);
    setError(null);
  }

  const title =
    step === "signup"
      ? "Créer ton compte"
      : step === "login"
        ? "Bon retour !"
        : "Connexion ou inscription";

  return (
    <div className="flex flex-col">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-center text-sm text-slate-600">
        {step === "email"
          ? "Entre ton email pour continuer."
          : step === "signup"
            ? "Plus qu'une étape pour rejoindre DogShift."
            : "Entre ton mot de passe pour te connecter."}
      </p>

      {resetOk ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900">
          Mot de passe mis à jour ✅ — connecte-toi avec ton nouveau mot de passe.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        {/* ── STEP: email ── */}
        {step === "email" ? (
          <>
            <form onSubmit={handleEmailContinue} className="space-y-5">
              <div>
                <label htmlFor="af-email" className="block text-sm font-medium text-slate-700">
                  E-mail
                </label>
                <input
                  id="af-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`mt-2 ${INPUT_CLASS}`}
                  placeholder="toi@exemple.com"
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-sm text-rose-900">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                aria-disabled={busy}
                aria-busy={checking}
                style={{ touchAction: "manipulation" }}
                className={PRIMARY_BTN_CLASS}
              >
                {checking ? "Un instant…" : "Continuer"}
              </button>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-slate-500">ou</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Social icon buttons — Airbnb-style, side by side */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => void handleGoogle()}
                aria-disabled={oauthInFlight}
                aria-busy={oauthInFlight}
                aria-label="Continuer avec Google"
                style={{ touchAction: "manipulation" }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-300 bg-white shadow-sm transition hover:bg-slate-50 active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
              >
                <GoogleIcon />
              </button>
              <button
                type="button"
                onClick={() => void handleApple()}
                aria-disabled={oauthInFlight}
                aria-busy={oauthInFlight}
                aria-label="Continuer avec Apple"
                style={{ touchAction: "manipulation" }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-300 bg-white shadow-sm transition hover:bg-slate-50 active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
              >
                <AppleIcon />
              </button>
            </div>
          </>
        ) : null}

        {/* ── STEP: login ── */}
        {step === "login" ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <EmailRow email={email} onEdit={backToEmail} />

            {noPassword ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Ce compte utilise Google ou n&apos;a pas encore de mot de passe. Utilise « Continuer
                avec Google » ou{" "}
                <Link href="/forgot-password" className="font-semibold underline underline-offset-2">
                  définis un mot de passe
                </Link>
                .
              </p>
            ) : null}

            <div>
              <label htmlFor="af-password" className="block text-sm font-medium text-slate-700">
                Mot de passe
              </label>
              <div className="relative mt-2">
                <input
                  id="af-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`${INPUT_CLASS} pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  style={{ touchAction: "manipulation" }}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-600"
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
              aria-disabled={busy}
              aria-busy={loading}
              style={{ touchAction: "manipulation" }}
              className={PRIMARY_BTN_CLASS}
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        ) : null}

        {/* ── STEP: signup ── */}
        {step === "signup" ? (
          <form onSubmit={handleSignup} className="space-y-5">
            <EmailRow email={email} onEdit={backToEmail} />

            <div>
              <label htmlFor="af-name" className="block text-sm font-medium text-slate-700">
                Prénom (optionnel)
              </label>
              <input
                id="af-name"
                type="text"
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`mt-2 ${INPUT_CLASS}`}
                placeholder="Alex"
                maxLength={80}
              />
            </div>

            <div>
              <label htmlFor="af-new-password" className="block text-sm font-medium text-slate-700">
                Mot de passe
              </label>
              <div className="relative mt-2">
                <input
                  id="af-new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className={`${INPUT_CLASS} pr-12`}
                  placeholder="8 caractères, 1 majuscule, 1 chiffre"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  style={{ touchAction: "manipulation" }}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-sm text-rose-900">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              aria-disabled={busy}
              aria-busy={loading}
              style={{ touchAction: "manipulation" }}
              className={PRIMARY_BTN_CLASS}
            >
              {loading ? "Création du compte…" : "Créer mon compte"}
            </button>

            <p className="text-center text-xs text-slate-500">
              En continuant, tu acceptes nos{" "}
              <Link href="/cgu" className="underline underline-offset-2 hover:text-slate-700">
                conditions d&apos;utilisation
              </Link>{" "}
              et notre{" "}
              <Link
                href="/confidentialite"
                className="underline underline-offset-2 hover:text-slate-700"
              >
                politique de confidentialité
              </Link>
              .
            </p>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#000" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.86 2.34-4.23 2.44-4.3-1.33-1.95-3.4-2.22-4.14-2.25-1.76-.18-3.43 1.04-4.32 1.04-.89 0-2.26-1.02-3.72-.99-1.91.03-3.68 1.11-4.67 2.82-1.99 3.45-.51 8.56 1.43 11.36.95 1.37 2.08 2.91 3.56 2.85 1.43-.06 1.97-.92 3.7-.92 1.72 0 2.21.92 3.72.89 1.54-.03 2.51-1.39 3.45-2.77 1.09-1.59 1.54-3.13 1.56-3.21-.03-.01-2.99-1.15-3.02-4.55zM14.28 3.78c.79-.96 1.32-2.29 1.18-3.62-1.14.05-2.52.76-3.33 1.71-.73.85-1.37 2.21-1.2 3.51 1.27.1 2.57-.65 3.35-1.6z" />
    </svg>
  );
}

function EmailRow({ email, onEdit }: { email: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
      <span className="truncate text-sm text-slate-700">{email}</span>
      <button
        type="button"
        onClick={onEdit}
        style={{ touchAction: "manipulation" }}
        className="ml-3 shrink-0 text-xs font-semibold text-slate-900 underline underline-offset-2"
      >
        Modifier
      </button>
    </div>
  );
}
