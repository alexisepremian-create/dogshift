"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import SunCornerGlow from "@/components/SunCornerGlow";
import PageLoader from "@/components/ui/PageLoader";
import { useHostUser } from "@/components/HostUserProvider";
import { lifecycleStatusLabel } from "@/lib/sitterContract";

type ContractPayload = {
  ok?: boolean;
  contract?: {
    title?: string;
    version?: string;
    content?: string;
  };
  lifecycleStatus?: string;
  signedContract?: unknown;
  contractSignerName?: string | null;
  contractSignedAt?: string | null;
  activatedAt?: string | null;
  activationCodeIssuedAt?: string | null;
  error?: string;
};

export default function HostContractPage() {
  const router = useRouter();
  const host = useHostUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ContractPayload | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/host/contract", { method: "GET", cache: "no-store" });
        const next = (await res.json().catch(() => null)) as ContractPayload | null;
        if (cancelled) return;
        if (!res.ok || !next?.ok) {
          setPayload(null);
          setError(next?.error === "CONTRACT_NOT_AVAILABLE" ? "La signature du contrat n’est pas encore ouverte pour votre compte." : "Impossible de charger le contrat.");
          return;
        }
        setPayload(next);
        if (typeof next.contractSignerName === "string" && next.contractSignerName.trim()) {
          setSignatureName(next.contractSignerName.trim());
        }
      } catch {
        if (cancelled) return;
        setPayload(null);
        setError("Impossible de charger le contrat.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function signContract() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/host/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted, confirmed, signatureName }),
      });
      const next = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      if (!res.ok || !next?.ok) {
        if (next?.error === "SIGNATURE_REQUIRED") {
          setError("Merci d’indiquer votre nom pour signer le contrat.");
        } else if (next?.error === "CONTRACT_ACCEPTANCE_REQUIRED") {
          setError("Vous devez confirmer avoir lu et accepté le contrat.");
        } else {
          setError("Impossible de signer le contrat pour le moment.");
        }
        return;
      }

      setSuccess(next.message ?? "Votre contrat a bien été signé. Vous recevrez votre code d’activation par courrier.");
      router.refresh();
      const refreshed = await fetch("/api/host/contract", { method: "GET", cache: "no-store" });
      const refreshedPayload = (await refreshed.json().catch(() => null)) as ContractPayload | null;
      if (refreshed.ok && refreshedPayload?.ok) {
        setPayload(refreshedPayload);
      }
    } catch {
      setError("Impossible de signer le contrat pour le moment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <PageLoader label="Chargement du contrat…" />;
  }

  const statusLabel = lifecycleStatusLabel(host.lifecycleStatus);
  const contractTitle = payload?.contract?.title ?? "Contrat DogShift";
  const contractVersion = payload?.contract?.version ?? "—";
  const contractContent = payload?.contract?.content ?? "";
  const isSigned = host.lifecycleStatus === "contract_signed" || host.lifecycleStatus === "activated";

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="host-contract-page">
      <SunCornerGlow variant="sitterProfile" />
      <div className="relative z-10 grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
          <p className="text-sm font-semibold text-slate-600">Signature du contrat</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Engagement Dogsitter DogShift</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">Statut: {statusLabel}</span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">Version: {contractVersion}</span>
          </div>
          {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
          {success ? <p className="mt-4 text-sm font-medium text-emerald-700">{success}</p> : null}
          {isSigned ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Contrat signé</p>
              <p className="mt-1 text-sm text-emerald-900/80">
                Votre contrat a bien été signé. Vous recevrez votre code d’activation par courrier.
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{contractTitle}</h2>
              <p className="mt-1 text-sm text-slate-600">Veuillez lire le contrat avant signature.</p>
            </div>
          </div>

          <div className="mt-5 max-h-[420px] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{contractContent}</p>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={isSigned} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>Je reconnais avoir lu et accepté le contrat.</span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-900">Signature</span>
              <input
                type="text"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                disabled={isSigned}
                placeholder="Nom et prénom"
                className="h-12 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={isSigned} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>Je confirme que cette signature vaut engagement contractuel électronique.</span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void signContract()}
                disabled={isSigned || submitting}
                className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Signature en cours…" : "Signer le contrat"}
              </button>
              {host.activatedAt ? <span className="text-sm font-medium text-emerald-700">Compte activé.</span> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
