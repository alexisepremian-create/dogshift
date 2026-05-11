"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import AuthLayout from "@/components/auth/AuthLayout";

/**
 * Reset password page — reads ?token= and ?email= from the URL emitted by the
 * password-reset email. Submits to /api/auth/reset-password, then redirects to
 * /login?reset=ok on success.
 */
function ResetPasswordInner() {
  const router = useRouter();
  const search = useSearchParams();
  const token = (search?.get("token") ?? "").trim();
  const email = (search?.get("email") ?? "").trim();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingParams = !token || !email;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        if (body.error === "WEAK_PASSWORD") {
          setError("Mot de passe trop faible : minimum 8 caractères, avec une majuscule et un chiffre.");
        } else if (body.error === "INVALID_TOKEN") {
          setError("Lien invalide ou expiré. Recommence depuis « Mot de passe oublié ».");
        } else {
          setError("Une erreur est survenue. Réessaie dans un instant.");
        }
        setSubmitting(false);
        return;
      }
      router.replace("/login?reset=ok");
    } catch {
      setError("Erreur réseau. Réessaie dans un instant.");
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-slate-900">
        Nouveau mot de passe
      </h1>

      {missingParams ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-900">
          <p className="font-medium">Lien invalide.</p>
          <p className="mt-2">
            Le lien semble incomplet. Recommence la procédure depuis{" "}
            <Link href="/forgot-password" className="font-medium text-violet-700 underline-offset-2 hover:underline">
              Mot de passe oublié
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-center text-sm text-slate-600">
            Choisis un nouveau mot de passe pour <strong>{email}</strong>.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700">Nouveau mot de passe</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                placeholder="8 caractères, 1 majuscule, 1 chiffre"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-slate-700">Confirme le mot de passe</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Mise à jour…" : "Mettre à jour mon mot de passe"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthLayout><div className="mt-10 h-24 animate-pulse rounded bg-slate-100" /></AuthLayout>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
