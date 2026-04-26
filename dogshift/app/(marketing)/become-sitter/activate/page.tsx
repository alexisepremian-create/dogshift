"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { CheckCircle2, Dog, Bone, Heart, MapPin } from "lucide-react";

export default function BecomeSitterActivatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();

  const initialCode = searchParams?.get("code") ?? "";

  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => {
        router.replace("/host");
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [success, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Merci d'entrer ton code d'activation.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/host/activation-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });

      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!res.ok || !json?.ok) {
        const reason = json?.error ?? "UNKNOWN";
        if (reason === "INVALID_ACTIVATION_CODE") {
          setError("Code invalide. Vérifie que tu as bien copié le code depuis l'email.");
        } else if (reason === "ACCOUNT_NOT_READY_FOR_ACTIVATION") {
          setError("Ton compte n'est pas encore prêt pour l'activation. Contacte le support si besoin.");
        } else if (reason === "ACTIVATION_CODE_NOT_ISSUED") {
          setError("Aucun code d'activation n'a été émis pour ce compte. Contacte le support.");
        } else if (reason === "UNAUTHORIZED") {
          setError("Tu dois être connecté(e) pour activer ton compte.");
        } else {
          setError("Une erreur est survenue. Réessaie ou contacte le support.");
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Impossible d'activer le compte. Vérifie ta connexion et réessaie.");
      setLoading(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-slate-900">
        <BackgroundDecor />
        <main className="relative z-10 mx-auto flex min-h-[calc(100vh-120px)] max-w-6xl items-center justify-center px-4 py-14 sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl">
            <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
            <div className="mt-4 h-5 w-72 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </main>
      </div>
    );
  }

  if (!isSignedIn) {
    const loginHref = `/login`;
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-slate-900">
        <BackgroundDecor />
        <main className="relative z-10 mx-auto flex min-h-[calc(100vh-120px)] max-w-6xl items-center justify-center px-4 py-14 sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Activation du compte
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
              Connecte-toi pour activer ton compte
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Tu dois être connecté(e) à ton compte DogShift pour utiliser ton code d&apos;activation.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={loginHref}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
              >
                Se connecter
              </Link>
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
              Retour à l&apos;accueil
            </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (success) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-slate-900">
        <BackgroundDecor />
        <main className="relative z-10 mx-auto flex min-h-[calc(100vh-120px)] max-w-6xl items-center justify-center px-4 py-14 sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-6 text-center shadow-xl">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" strokeWidth={1.5} />
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
              Compte activé ! 🎉
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Ton compte dogsitter est maintenant actif. Tu vas être redirigé(e) vers ton tableau de bord.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      <BackgroundDecor />
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-120px)] max-w-6xl items-center justify-center px-4 py-14 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Activation du compte dogsitter
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
            Active ton compte DogShift
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Saisis le code d&apos;activation reçu par email après la signature de ton contrat.
          </p>

          <form onSubmit={onSubmit} className="mt-6">
            <label htmlFor="activation-code" className="block text-sm font-medium text-slate-700">
              Code d&apos;activation
            </label>
            <input
              id="activation-code"
              aria-label="Code d'activation"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={loading}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-mono tracking-widest text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-normal focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="DS-XXXX-XXXX"
              autoComplete="one-time-code"
              spellCheck={false}
            />

            {error ? (
              <p className="mt-3 text-center text-sm font-medium text-rose-600">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Activation en cours…" : "Activer mon compte dogsitter"}
            </button>

            <Link
              href="/"
              className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Retour à l&apos;accueil
            </Link>
          </form>
        </div>
      </main>
    </div>
  );
}

function BackgroundDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <Dog className="absolute right-8 top-32 h-48 w-48 rotate-12 text-[#2f4d6b]/20" strokeWidth={1.5} />
      <Bone className="absolute bottom-32 left-8 h-36 w-36 -rotate-12 text-[#7969F0]/20" strokeWidth={1.5} />
      <Heart className="absolute left-10 top-24 h-32 w-32 -rotate-12 text-[#7969F0]/[0.04]" strokeWidth={1.5} />
      <MapPin className="absolute bottom-24 right-12 h-40 w-40 rotate-12 text-[#2f4d6b]/[0.04]" strokeWidth={1.5} />
    </div>
  );
}
