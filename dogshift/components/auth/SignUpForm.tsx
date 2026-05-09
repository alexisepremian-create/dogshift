"use client";

import * as Clerk from "@clerk/elements/common";
import * as SignUp from "@clerk/elements/sign-up";
import Link from "next/link";

export default function SignUpForm() {
  return (
    <SignUp.Root>
      <div className="flex flex-col">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
          Créer un compte
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Rejoins DogShift dès maintenant.
        </p>

        <div className="mt-6 flex flex-col gap-6">
          {/* Google OAuth */}
          <Clerk.Loading scope="provider:google">
            {(loading) => (
              <Clerk.Connection
                name="google"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Redirection…" : "S'inscrire avec Google"}
              </Clerk.Connection>
            )}
          </Clerk.Loading>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-slate-500">ou</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Step 1: Email */}
          <SignUp.Step name="start" className="space-y-5">
            <Clerk.GlobalError className="block text-center text-sm text-rose-600" />

            <Clerk.Field name="emailAddress">
              <Clerk.Label className="block text-sm font-medium text-slate-700">
                E-mail
              </Clerk.Label>
              <Clerk.Input
                type="email"
                autoComplete="email"
                placeholder="toi@exemple.com"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <Clerk.FieldError className="mt-1 block text-center text-sm text-rose-600" />
            </Clerk.Field>

            <Clerk.Loading>
              {(loading) => (
                <SignUp.Action
                  submit
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Envoi…" : "S'inscrire par e-mail"}
                </SignUp.Action>
              )}
            </Clerk.Loading>
          </SignUp.Step>

          {/* Step 2: OTP verification */}
          <SignUp.Step name="verifications">
            <SignUp.Strategy name="email_code">
              <div className="space-y-6">
                <Clerk.GlobalError className="block text-center text-sm text-rose-600" />

                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-slate-700">Code envoyé à</p>
                  <p className="text-xs text-slate-500">
                    Vérifie ta boîte mail (et les spams) — valable 10 minutes.
                  </p>
                </div>

                <Clerk.Field name="code" className="space-y-3">
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
                  <Clerk.FieldError className="block text-center text-sm text-rose-600" />
                </Clerk.Field>

                <Clerk.Loading>
                  {(loading) => (
                    <SignUp.Action
                      submit
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Vérification…" : "Valider le code"}
                    </SignUp.Action>
                  )}
                </Clerk.Loading>

                <div className="flex flex-col items-center gap-2">
                  <SignUp.Action
                    resend
                    fallback={({ resendableAfter }) => (
                      <button
                        type="button"
                        disabled
                        className="text-sm font-medium text-slate-600 disabled:opacity-50"
                      >
                        Renvoyer dans {resendableAfter}s
                      </button>
                    )}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                  >
                    Renvoyer un nouveau code
                  </SignUp.Action>

                  <SignUp.Action
                    navigate="start"
                    className="text-sm text-slate-400 hover:text-slate-600 transition"
                  >
                    ← Changer d&apos;adresse e-mail
                  </SignUp.Action>
                </div>
              </div>
            </SignUp.Strategy>
          </SignUp.Step>
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
    </SignUp.Root>
  );
}
