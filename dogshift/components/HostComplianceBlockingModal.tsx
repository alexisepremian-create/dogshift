"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { HostUser } from "@/components/HostUserProvider";
import Spinner from "@/components/ui/Spinner";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

type Props = {
  host: HostUser;
};

export default function HostComplianceBlockingModal({ host }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedOverride, setAcceptedOverride] = useState(false);

  const needsTermsAcceptance = useMemo(() => {
    if (acceptedOverride) return false;
    if (!host.sitterId) return false;
    if (!host.termsAcceptedAt) return true;
    if (!host.termsVersion) return true;
    return host.termsVersion !== CURRENT_TERMS_VERSION;
  }, [acceptedOverride, host.sitterId, host.termsAcceptedAt, host.termsVersion]);

  const activeAmendment = host.contractAmendment.activeAmendment;
  const needsAmendmentAcceptance = useMemo(() => {
    if (acceptedOverride) return false;
    return Boolean(host.sitterId && host.contractAmendment.needsAcceptance && activeAmendment?.id);
  }, [acceptedOverride, activeAmendment?.id, host.contractAmendment.needsAcceptance, host.sitterId]);

  const needsCombinedAcceptance = needsTermsAcceptance && needsAmendmentAcceptance;
  const needsAnyAcceptance = needsTermsAcceptance || needsAmendmentAcceptance;

  if (!needsAnyAcceptance) return null;

  async function accept() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const endpoint = needsCombinedAcceptance ? "/api/host/accept-compliance" : needsTermsAcceptance ? "/api/host/accept-terms" : "/api/host/contract-amendment/accept";
      const res = await fetch(endpoint, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        if (res.status === 403) {
          setError("Créez d’abord votre profil dogsitter pour accepter ces conditions.");
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

  const buttonLabel = needsCombinedAcceptance
    ? "J’accepte les conditions et l’avenant"
    : needsTermsAcceptance
      ? "J’accepte les conditions"
      : "J’accepte l’avenant";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-8">
      <button type="button" className="absolute inset-0 bg-slate-900/45" aria-label="Modal" disabled />
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_80px_-45px_rgba(2,6,23,0.6)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conformité contractuelle</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          {needsCombinedAcceptance ? "Veuillez accepter les conditions et l’avenant pour continuer à utiliser DogShift" : "Veuillez accepter les éléments requis pour continuer à utiliser DogShift"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {needsCombinedAcceptance
            ? "Votre compte requiert à la fois l’acceptation des CGU sitter et de l’avenant contractuel actif. Une seule validation suffit pour enregistrer les deux acceptations."
            : needsTermsAcceptance
              ? "Merci de lire et accepter les CGU sitter pour déverrouiller l’accès normal à la plateforme."
              : "Cet avenant est requis car votre version de contrat actuelle est antérieure à la dernière version active."}
        </p>

        {needsTermsAcceptance ? (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CGU</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              DogShift applique des CGU spécifiques aux sitters pour encadrer l’utilisation de la plateforme et les actions sensibles.
            </p>
            <div className="mt-3">
              <Link href="/cgu" className="text-sm font-semibold text-[var(--dogshift-blue)]" target="_blank" rel="noreferrer">
                Lire les CGU
              </Link>
            </div>
          </section>
        ) : null}

        {needsAmendmentAcceptance && activeAmendment ? (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1">Avenant</span>
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1">Version active: {activeAmendment.version}</span>
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1">Titre: {activeAmendment.title}</span>
            </div>
            <div className="mt-4 max-h-[320px] overflow-auto rounded-2xl border border-slate-200 bg-white p-4">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{activeAmendment.content}</p>
            </div>
          </section>
        ) : null}

        {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

        <button
          type="button"
          onClick={() => void accept()}
          disabled={submitting}
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center justify-center">
              <Spinner className="h-4 w-4" />
            </span>
          ) : (
            buttonLabel
          )}
        </button>
      </div>
    </div>
  );
}
