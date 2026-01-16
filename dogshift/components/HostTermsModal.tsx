"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useHostUser } from "@/components/HostUserProvider";
import Spinner from "@/components/ui/Spinner";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export default function HostTermsModal() {
  const host = useHostUser();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedOverride, setAcceptedOverride] = useState(false);

  if (!host.sitterId) return null;

  const needsAcceptance = useMemo(() => {
    if (acceptedOverride) return false;
    if (!host.termsAcceptedAt) return true;
    if (!host.termsVersion) return true;
    return host.termsVersion !== CURRENT_TERMS_VERSION;
  }, [acceptedOverride, host.termsAcceptedAt, host.termsVersion]);

  if (!needsAcceptance) return null;

  async function accept() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/host/accept-terms", { method: "POST" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !json?.ok) {
        if (res.status === 403) {
          setError("Créez d’abord votre profil dogsitter pour accepter ces CGU.");
          setSubmitting(false);
          return;
        }
        setError("Impossible d’enregistrer votre acceptation. Réessayez.");
        setSubmitting(false);
        return;
      }
      setAcceptedOverride(true);
      setSubmitting(false);
    } catch {
      setError("Impossible d’enregistrer votre acceptation. Réessayez.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Modal" disabled />
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_80px_-45px_rgba(2,6,23,0.6)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Règlement / CGU sitter</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Avant de continuer</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          DogShift est un service premium. Pour protéger les propriétaires comme les dogsitters, nous appliquons un règlement strict et des CGU
          spécifiques aux sitters.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Merci de lire et accepter ces conditions pour déverrouiller les actions sensibles (publication, visibilité, etc.).
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <Link href="/cgu" className="text-sm font-semibold text-[var(--dogshift-blue)]" target="_blank" rel="noreferrer">
            Lire les CGU
          </Link>
        </div>

        {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

        <button
          type="button"
          onClick={() => void accept()}
          disabled={submitting}
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center justify-center">
              <Spinner className="h-4 w-4 animate-spin" />
            </span>
          ) : (
            "J’accepte"
          )}
        </button>
      </div>
    </div>
  );
}
