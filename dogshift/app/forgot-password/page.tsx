"use client";

import { useState } from "react";
import Link from "next/link";

import AuthLayout from "@/components/auth/AuthLayout";

/**
 * Forgot password page — DogShift.
 *
 * Posts to /api/auth/forgot-password and always renders the same neutral
 * success state to avoid leaking which emails are registered.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // Even on network error we show the generic confirmation — the user
      // gets the same instruction either way ("check your inbox").
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <AuthLayout>
      <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-slate-900">
        Mot de passe oublié
      </h1>

      {submitted ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-900">
          <p className="font-medium">Si un compte existe pour cet email, tu recevras un lien de réinitialisation.</p>
          <p className="mt-2 text-emerald-800">
            Pense à vérifier tes spams. Le lien expire dans 1 heure.
          </p>
          <div className="mt-4">
            <Link href="/login" className="text-sm font-medium text-violet-700 underline-offset-2 hover:underline">
              Retour à la connexion
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-center text-sm text-slate-600">
            Entre l&apos;adresse email associée à ton compte. On t&apos;envoie un lien pour définir un nouveau mot de passe.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                placeholder="toi@exemple.ch"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Envoi…" : "Envoyer le lien"}
            </button>

            <div className="text-center text-sm">
              <Link href="/login" className="text-slate-600 underline-offset-2 hover:text-violet-700 hover:underline">
                Retour à la connexion
              </Link>
            </div>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
