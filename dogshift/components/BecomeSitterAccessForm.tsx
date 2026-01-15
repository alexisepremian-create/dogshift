"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function BecomeSitterAccessForm({
  isUnlocked,
  children,
}: {
  isUnlocked: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isUnlocked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isUnlocked]);

  const locked = useMemo(() => !isUnlocked, [isUnlocked]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Merci d’entrer un code d’invitation.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/invites/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });

      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        const reason = json?.error || "CODE_INVALID";
        if (reason === "CODE_EXPIRED") setError("Ce code a expiré.");
        else if (reason === "CODE_ALREADY_USED") setError("Ce code a déjà été utilisé.");
        else if (reason === "CODE_REQUIRED") setError("Merci d’entrer un code d’invitation.");
        else setError("Code invalide.");
        setLoading(false);
        return;
      }

      router.replace("/become-sitter/form");
    } catch {
      setError("Impossible de vérifier le code. Réessaie.");
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className={locked ? "blur-sm opacity-60 pointer-events-none select-none" : ""}>{children}</div>

      {locked ? (
        <div className="absolute inset-0">
          <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px]" aria-hidden="true" />
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">DogShift est en phase pilote</h2>
              <p className="mt-2 text-sm text-slate-600">
                Nous ouvrons l’accès progressivement. Chaque dogsitter est sélectionné manuellement pour garantir un niveau de confiance maximal dès les
                premières réservations.
              </p>

              <form onSubmit={onSubmit} className="mt-6">
                <label htmlFor="invite" className="block text-sm font-medium text-slate-700">
                  Code d’accès
                </label>
                <input
                  id="invite"
                  aria-label="Code d’accès"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={loading}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="DS-XXXX-XXXX"
                  autoComplete="one-time-code"
                />

                {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Vérification…" : "Déverrouiller"}
                </button>

                <div className="mt-4 text-center">
                  <a href="mailto:support@dogshift.ch" className="text-sm font-semibold text-[var(--dogshift-blue)]">
                    Je n’ai pas de code
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
