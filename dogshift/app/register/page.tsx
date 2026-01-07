"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    router.replace("/account");
  }, [status, router]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Créer un compte</h1>
          <p className="mt-2 text-sm text-slate-600">Inscription propriétaire avec email + mot de passe.</p>

          <div className="mt-8 space-y-4" aria-label="Formulaire d'inscription" suppressHydrationWarning>
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                {error}
              </div>
            ) : null}

            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Nom (optionnel)
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
              placeholder="Votre nom"
            />

            <label htmlFor="email" className="mt-4 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
              placeholder="vous@exemple.com"
            />

            <label htmlFor="password" className="mt-4 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
              placeholder="8 caractères minimum"
            />

            <button
              type="button"
              disabled={submitting || !email.trim() || password.length < 8}
              onClick={async () => {
                const normalizedEmail = email.trim();
                if (!normalizedEmail) return;

                setSubmitting(true);
                setError(null);

                try {
                  const res = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: name.trim() || undefined, email: normalizedEmail, password }),
                  });

                  const payload = (await res.json()) as { ok?: boolean; error?: string };

                  if (!res.ok || !payload.ok) {
                    if (payload.error === "EMAIL_ALREADY_REGISTERED") {
                      setError("Un compte existe déjà avec cet email.");
                      return;
                    }
                    if (payload.error === "PASSWORD_TOO_SHORT") {
                      setError("Mot de passe trop court (8 caractères minimum).");
                      return;
                    }
                    if (payload.error === "INVALID_EMAIL") {
                      setError("Email invalide.");
                      return;
                    }
                    setError("Impossible de créer le compte. Réessaie.");
                    return;
                  }

                  await signIn("credentials", {
                    email: normalizedEmail,
                    password,
                  });
                } catch (err) {
                  setError("Impossible de créer le compte. Réessaie.");
                } finally {
                  setSubmitting(false);
                }
              }}
              className="mt-3 w-full rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              Créer mon compte
            </button>
          </div>

          <p className="mt-6 text-sm text-slate-600">
            Déjà un compte?{" "}
            <Link href="/login" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
              Se connecter
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
