"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BecomeSitterAccessForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Accès sur invitation</h1>
      <p className="mt-2 text-sm text-slate-600">Entre ton code d’invitation pour déverrouiller le formulaire.</p>

      <div className="mt-6">
        <label htmlFor="invite" className="block text-sm font-medium text-slate-700">
          Code d’invitation
        </label>
        <input
          id="invite"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={loading}
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="DS-XXXX-XXXX"
          autoComplete="one-time-code"
        />
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Vérification…" : "Déverrouiller le formulaire"}
      </button>
    </form>
  );
}
