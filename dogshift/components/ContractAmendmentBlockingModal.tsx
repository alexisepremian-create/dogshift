"use client";

import { useMemo, useState } from "react";

import Spinner from "@/components/ui/Spinner";
import type { HostContractAmendmentState } from "@/lib/contractAmendments";

type Props = {
  sitterId: string | null;
  state: HostContractAmendmentState;
};

export default function ContractAmendmentBlockingModal({ sitterId, state }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedOverride, setAcceptedOverride] = useState(false);

  const activeAmendment = state.activeAmendment;

  const needsAcceptance = useMemo(() => {
    if (acceptedOverride) return false;
    return Boolean(sitterId && state.needsAcceptance && activeAmendment?.id);
  }, [acceptedOverride, activeAmendment?.id, sitterId, state.needsAcceptance]);

  if (!needsAcceptance || !activeAmendment) return null;

  async function accept() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/host/contract-amendment/accept", { method: "POST" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !json?.ok) {
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-8">
      <button type="button" className="absolute inset-0 bg-slate-900/45" aria-label="Modal" disabled />
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_80px_-45px_rgba(2,6,23,0.6)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avenant contractuel</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Veuillez accepter les nouvelles conditions pour continuer à utiliser DogShift</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Cet avenant est requis car votre version de contrat actuelle est antérieure à la dernière version active. Tant que cet avenant n’est pas accepté,
          l’accès normal à DogShift reste bloqué.
        </p>

        <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">Version active: {activeAmendment.version}</span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">Titre: {activeAmendment.title}</span>
        </div>

        <div className="mt-5 max-h-[320px] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{activeAmendment.content}</p>
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
