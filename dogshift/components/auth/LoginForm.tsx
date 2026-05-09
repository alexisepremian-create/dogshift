"use client";

import * as Clerk from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";
import Link from "next/link";

export default function LoginForm() {
  const inputClass =
    "mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60";

  const primaryBtn =
    "inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

  const secondaryBtn =
    "inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

  const OtpDigitInput = (
    <Clerk.Input
      type="otp"
      length={6}
      autoSubmit
      className="flex items-center justify-center gap-2.5"
      render={({ value, status }) => (
        <div
          data-status={status}
          className={[
            "h-14 w-11 select-none rounded-2xl border text-center text-xl font-semibold text-slate-900 shadow-sm transition-all flex items-center justify-center",
            value
              ? "border-slate-900 bg-white ring-2 ring-slate-900/10"
              : "border-slate-300 bg-white",
            status === "cursor" || status === "selected"
              ? "border-slate-800 ring-4 ring-slate-200"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {value}
        </div>
      )}
    />
  );

  return (
    <SignIn.Root>
      <div className="flex flex-col">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
          S&apos;identifier
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Accède à ton espace DogShift.
        </p>

        <div className="mt-6 flex flex-col gap-6">
          {/* Google OAuth */}
          <Clerk.Loading scope="provider:google">
            {(loading) => (
              <Clerk.Connection
                name="google"
                disabled={loading}
                className={secondaryBtn}
              >
                {loading ? "Redirection…" : "Continuer avec Google"}
              </Clerk.Connection>
            )}
          </Clerk.Loading>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-slate-500">ou</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* ── Step 1: identifier ─────────────────────────────────── */}
          <SignIn.Step name="start" className="space-y-5">
            <Clerk.GlobalError className="block text-center text-sm text-rose-600" />

            <Clerk.Field name="identifier">
              <Clerk.Label className="block text-sm font-medium text-slate-700">
                E-mail
              </Clerk.Label>
              <Clerk.Input
                type="email"
                autoComplete="email"
                placeholder="toi@exemple.com"
                className={inputClass}
              />
              <Clerk.FieldError className="mt-1 block text-center text-sm text-rose-600" />
            </Clerk.Field>

            <Clerk.Loading>
              {(loading) => (
                <SignIn.Action submit disabled={loading} className={primaryBtn}>
                  {loading ? "Vérification…" : "Continuer"}
                </SignIn.Action>
              )}
            </Clerk.Loading>
          </SignIn.Step>

          {/* ── Step 2: verifications (1st + 2nd factor) ──────────── */}
          <SignIn.Step name="verifications">
            <Clerk.GlobalError className="mb-4 block text-center text-sm text-rose-600" />

            {/* ·· First factor ·· */}
            <SignIn.FirstFactor>
              {/* Password */}
              <SignIn.Strategy name="password">
                <div className="space-y-5">
                  <Clerk.Field name="password">
                    <Clerk.Label className="block text-sm font-medium text-slate-700">
                      Mot de passe
                    </Clerk.Label>
                    <Clerk.Input
                      type="password"
                      autoComplete="current-password"
                      autoFocus
                      placeholder="••••••••"
                      className={inputClass}
                    />
                    <Clerk.FieldError className="mt-1 block text-center text-sm text-rose-600" />
                  </Clerk.Field>

                  <Clerk.Loading>
                    {(loading) => (
                      <SignIn.Action submit disabled={loading} className={primaryBtn}>
                        {loading ? "Connexion…" : "Se connecter"}
                      </SignIn.Action>
                    )}
                  </Clerk.Loading>

                  <SignIn.Action navigate="choose-strategy" className={secondaryBtn}>
                    Utiliser un code par e-mail
                  </SignIn.Action>

                  <SignIn.Action
                    navigate="start"
                    className="block w-full text-center text-sm text-slate-500 hover:text-slate-700 transition"
                  >
                    ← Changer d&apos;e-mail
                  </SignIn.Action>
                </div>
              </SignIn.Strategy>

              {/* Email OTP (passwordless or fallback) */}
              <SignIn.Strategy name="email_code">
                <div className="space-y-6">
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-slate-700">Code envoyé à</p>
                    <p className="text-sm font-semibold text-slate-900">
                      <SignIn.SafeIdentifier />
                    </p>
                    <p className="text-xs text-slate-500">
                      Vérifie ta boîte mail (et les spams) — valable 10 minutes.
                    </p>
                  </div>

                  <Clerk.Field name="code" className="space-y-3">
                    {OtpDigitInput}
                    <Clerk.FieldError className="block text-center text-sm text-rose-600" />
                  </Clerk.Field>

                  <Clerk.Loading>
                    {(loading) => (
                      <SignIn.Action submit disabled={loading} className={primaryBtn}>
                        {loading ? "Vérification…" : "Valider le code"}
                      </SignIn.Action>
                    )}
                  </Clerk.Loading>

                  <div className="flex flex-col items-center gap-2">
                    <SignIn.Action
                      resend
                      fallback={({ resendableAfter }) => (
                        <button type="button" disabled className="text-sm font-medium text-slate-600 disabled:opacity-50">
                          Renvoyer dans {resendableAfter}s
                        </button>
                      )}
                      className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                    >
                      Renvoyer un nouveau code
                    </SignIn.Action>

                    <SignIn.Action
                      navigate="start"
                      className="text-sm text-slate-400 hover:text-slate-600 transition"
                    >
                      ← Changer d&apos;e-mail
                    </SignIn.Action>
                  </div>
                </div>
              </SignIn.Strategy>
            </SignIn.FirstFactor>

            {/* ·· Second factor (MFA) ·· */}
            <SignIn.SecondFactor>
              <SignIn.Strategy name="email_code">
                <div className="space-y-6">
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-slate-700">Vérification supplémentaire</p>
                    <p className="text-xs text-slate-500">
                      Un code de sécurité a été envoyé à ton adresse e-mail.
                    </p>
                  </div>

                  <Clerk.Field name="code" className="space-y-3">
                    {OtpDigitInput}
                    <Clerk.FieldError className="block text-center text-sm text-rose-600" />
                  </Clerk.Field>

                  <Clerk.Loading>
                    {(loading) => (
                      <SignIn.Action submit disabled={loading} className={primaryBtn}>
                        {loading ? "Vérification…" : "Valider le code"}
                      </SignIn.Action>
                    )}
                  </Clerk.Loading>

                  <div className="flex flex-col items-center">
                    <SignIn.Action
                      resend
                      fallback={({ resendableAfter }) => (
                        <button type="button" disabled className="text-sm font-medium text-slate-600 disabled:opacity-50">
                          Renvoyer dans {resendableAfter}s
                        </button>
                      )}
                      className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                    >
                      Renvoyer un nouveau code
                    </SignIn.Action>
                  </div>
                </div>
              </SignIn.Strategy>
            </SignIn.SecondFactor>
          </SignIn.Step>

          {/* ── Step 3: choose strategy ────────────────────────────── */}
          <SignIn.Step name="choose-strategy" className="space-y-4">
            <p className="text-center text-sm text-slate-600">Choisis ta méthode de connexion</p>

            <SignIn.SupportedStrategy name="email_code">
              <SignIn.Action navigate="previous" className={primaryBtn}>
                Recevoir un code par e-mail
              </SignIn.Action>
            </SignIn.SupportedStrategy>

            <SignIn.SupportedStrategy name="password">
              <SignIn.Action navigate="previous" className={secondaryBtn}>
                Utiliser mon mot de passe
              </SignIn.Action>
            </SignIn.SupportedStrategy>

            <SignIn.Action
              navigate="start"
              className="block w-full text-center text-sm text-slate-500 hover:text-slate-700 transition"
            >
              ← Changer d&apos;e-mail
            </SignIn.Action>
          </SignIn.Step>
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
    </SignIn.Root>
  );
}
