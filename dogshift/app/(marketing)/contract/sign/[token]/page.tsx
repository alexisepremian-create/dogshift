"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { formatSwissDateTimeHuman } from "@/lib/datetime/formatSwissDateTime";
import PageLoader from "@/components/ui/PageLoader";

type ContractPayload = {
  ok?: boolean;
  readonly?: boolean;
  signedForThisVersion?: boolean;
  contractSnapshot?: any;
  contractSignedPdfUrl?: string | null;
  infoMessage?: string | null;
  sitter?: {
    sitterId?: string | null;
    name?: string | null;
    email?: string | null;
  };
  contract?: {
    title?: string;
    version?: string;
    content?: string;
  };
  lifecycleStatus?: string;
  contractSignerName?: string | null;
  contractSignedAt?: string | null;
  error?: string;
};

export default function SecureContractSigningPage() {
  const params = useParams<{ token: string }>();
  const tokenParam = params?.token;
  const token = typeof tokenParam === "string" ? tokenParam : Array.isArray(tokenParam) ? tokenParam[0] : "";

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ContractPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  function formatSignedAtHumanFrCh(iso: string) {
    return formatSwissDateTimeHuman(iso);
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/contract/sign/${encodeURIComponent(token)}`, { method: "GET", cache: "no-store" });
        const next = (await res.json().catch(() => null)) as ContractPayload | null;
        if (cancelled) return;
        if (!res.ok || !next?.ok) {
          if (next?.error === "CONTRACT_LINK_ALREADY_USED") {
            setError("Ce lien de signature a déjà été utilisé et n’est plus valide.");
          } else if (next?.error === "CONTRACT_LINK_EXPIRED") {
            setError("Ce lien de signature a expiré. Contactez DogShift pour recevoir un nouveau lien.");
        } else if (next?.error === "CONTRACT_ALREADY_SIGNED") {
          setError("Cette version du contrat a déjà été signée.");
          } else {
            setError("Ce lien de signature est invalide ou n’est plus disponible.");
          }
          setPayload(null);
          return;
        }
        setPayload(next);
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
  }, [token]);

  async function signContract() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/contract/sign/${encodeURIComponent(token)}`, {
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
        } else if (next?.error === "CONTRACT_LINK_ALREADY_USED") {
          setError("Ce lien de signature a déjà été utilisé et n’est plus valide.");
        } else if (next?.error === "CONTRACT_LINK_EXPIRED") {
          setError("Ce lien de signature a expiré. Contactez DogShift pour recevoir un nouveau lien.");
        } else if (next?.error === "CONTRACT_ALREADY_SIGNED") {
          setError("Cette version du contrat a déjà été signée. Ce lien ne permet plus de signer.");
        } else {
          setError("Impossible de signer le contrat pour le moment.");
        }
        return;
      }

      setSuccess(next.message ?? "Votre contrat a bien été signé. DogShift vous contactera pour la suite de l’activation.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      const refreshed = await fetch(`/api/contract/sign/${encodeURIComponent(token)}`, { method: "GET", cache: "no-store" });
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

  // Signature inputs are disabled once signed (for this token version).
  const isSigned = success !== null || payload?.signedForThisVersion === true;
  const showSignedBanner = Boolean(isSigned && payload?.contractSignerName && payload?.contractSignedAt);
  const contractTitle = payload?.contract?.title ?? "Contrat DogShift";
  const contractVersion = payload?.contract?.version ?? "—";
  const contractContent = payload?.contract?.content ?? "";
  const signedAtHuman = payload?.contractSignedAt ? formatSignedAtHumanFrCh(payload.contractSignedAt) : null;

  async function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadSignedContractPdf() {
    if (!payload?.contractSnapshot || !payload?.contractSignerName || !payload?.contractSignedAt) return;
    if (pdfLoading) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      // Le token est passé pour authentifier la requête sans Clerk
      // (les sitters signent via lien magique, ils n'ont pas de compte actif)
      const res = await fetch("/api/contract/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractSnapshot: payload.contractSnapshot,
          contractSignerName: payload.contractSignerName,
          contractSignedAt: payload.contractSignedAt,
          contractVersion: contractVersion,
          token,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/pdf")) {
        const blob = await res.blob();
        await downloadBlob(blob, `dogshift-contrat-signe-${contractVersion}.pdf`);
        return;
      }

      const data = (await res.json().catch(() => null)) as any;
      const pdfUrl = data?.pdfUrl as string | undefined;
      if (!pdfUrl) throw new Error("missing pdfUrl");
      const pdfRes = await fetch(pdfUrl);
      const blob = await pdfRes.blob();
      await downloadBlob(blob, `dogshift-contrat-signe-${contractVersion}.pdf`);
    } catch {
      setPdfError("Impossible de télécharger le PDF pour le moment.");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-4xl gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
          <p className="text-sm font-semibold text-slate-600">Signature du contrat DogShift</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Accès sécurisé au contrat</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">Version: {contractVersion}</span>
            {payload?.sitter?.name ? <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">Candidat(e): {payload.sitter.name}</span> : null}
          </div>
          {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
          {success ? <p className="mt-4 text-sm font-medium text-emerald-700">{success}</p> : null}
          {payload?.readonly && payload.infoMessage ? <p className="mt-4 text-sm font-medium text-slate-700">{payload.infoMessage}</p> : null}
          {showSignedBanner ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Contrat signé</p>
              {signedAtHuman ? <p className="mt-1 text-xs text-slate-600">{`Signé le ${signedAtHuman}`}</p> : null}
              {payload?.contractSignerName && signedAtHuman ? (
                <p className="mt-2 whitespace-pre-line text-xs text-slate-600">{`Signé électroniquement par:\n${payload.contractSignerName}\n\nLe: ${signedAtHuman}`}</p>
              ) : null}
              <p className="mt-1 text-sm text-emerald-900/80">
                Votre contrat a bien été signé. Aucun accès dashboard n’est ouvert à ce stade ; DogShift vous contactera pour l’activation ultérieure.
              </p>

              {payload?.contractSnapshot && payload?.contractSignerName && payload?.contractSignedAt ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => void downloadSignedContractPdf()}
                    disabled={pdfLoading}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {pdfLoading ? "Génération…" : "Télécharger le contrat signé (PDF)"}
                  </button>
                  {pdfError ? <p className="mt-2 text-xs text-rose-600">{pdfError}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{contractTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">Veuillez lire le contrat avant signature. Aucun accès dashboard n’est disponible sur cette page.</p>
          </div>

          <div className="mt-5 max-h-[420px] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{contractContent}</p>
          </div>

          {!error ? (
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

              <div className="mt-4 flex justify-stretch sm:justify-end">
                <button
                  type="button"
                  onClick={() => void signContract()}
                  disabled={isSigned || submitting}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? "Signature en cours…" : "Signer le contrat"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
