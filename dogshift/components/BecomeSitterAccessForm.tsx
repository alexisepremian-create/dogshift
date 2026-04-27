"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function BecomeSitterAccessForm({
  onUnlocked,
}: {
  onUnlocked?: () => void;
}) {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(() => searchParams?.get("code") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Merci d'entrer un code d'accès.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // 1. Try InviteCode first (pilot access — no auth needed)
      const inviteRes = await fetch("/api/invites/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const inviteJson = (await inviteRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (inviteRes.ok && inviteJson?.ok) {
        if (typeof onUnlocked === "function") onUnlocked();
        window.location.assign("/become-sitter/form");
        return;
      }

      // 2. Try sitter activation code (no auth needed — code is the proof of identity)
      const activationRes = await fetch("/api/host/activation-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const activationJson = (await activationRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        hasClerkAccount?: boolean;
      } | null;

      if (activationRes.ok && activationJson?.ok) {
        // Cookies set server-side by the API — redirect to the full registration form.
        window.location.assign("/become-sitter/form");
        return;
      }

      const activationReason = activationJson?.error ?? "";
      if (activationReason === "INVALID_ACTIVATION_CODE") {
        setError("Code invalide. Vérifie que tu as bien copié le code depuis l'email.");
        setLoading(false);
        return;
      }
      if (activationReason === "ACTIVATION_CODE_ALREADY_USED") {
        setError("Ce code d'activation a déjà été utilisé.");
        setLoading(false);
        return;
      }
      if (activationReason === "ACTIVATION_CODE_EXPIRED") {
        setError("Ce code d'activation a expiré. Contacte le support pour en obtenir un nouveau.");
        setLoading(false);
        return;
      }
      if (activationReason === "ACCOUNT_NOT_READY_FOR_ACTIVATION") {
        setError("Ton compte n'est pas encore prêt pour l'activation. Contacte le support si besoin.");
        setLoading(false);
        return;
      }

      // Fall back to InviteCode error messages
      const inviteReason = inviteJson?.error ?? "CODE_INVALID";
      if (inviteReason === "CODE_EXPIRED") setError("Ce code a expiré.");
      else if (inviteReason === "CODE_ALREADY_USED") setError("Ce code a déjà été utilisé.");
      else if (inviteReason === "CODE_REQUIRED") setError("Merci d'entrer un code d'accès.");
      else setError("Code invalide.");
      setLoading(false);
    } catch {
      setError("Impossible de vérifier le code. Réessaie.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl" role="dialog" aria-modal="true">
      <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
        Accès restreint – Phase pilote
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">DogShift est en phase pilote</h2>
      <p className="mt-2 text-sm text-slate-600">
        Nous ouvrons l&apos;accès progressivement et en quantité limitée. Chaque dogsitter est sélectionné minutieusement pour garantir un niveau de confiance
        maximal dès les premières réservations.
      </p>

      <form onSubmit={onSubmit} className="mt-6">
        <label htmlFor="invite" className="block text-sm font-medium text-slate-700">
          Code d&apos;accès
        </label>
        <input
          id="invite"
          aria-label="Code d'accès"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={loading}
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="DS-XXXX-XXXX"
          autoComplete="one-time-code"
        />

        {error ? <p className="mt-3 text-center text-sm font-medium text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Vérification…" : "Déverrouiller"}
        </button>

        <Link
          href="/"
          className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          Retour à l&apos;accueil
        </Link>
      </form>
    </div>
  );
}
