"use client";

import { useEffect, useMemo, useState } from "react";

type Amendment = {
  id: string;
  title: string;
  content: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  activatedAt: string | null;
  acceptances: Array<{
    acceptedAt: string;
    amendmentVersion: string;
    sitterProfile: {
      sitterId?: string | null;
      displayName?: string | null;
      user?: {
        name?: string | null;
        email?: string | null;
      } | null;
    };
  }>;
};

type SitterRow = {
  id: string;
  name?: string | null;
  email: string;
  sitterProfile?: {
    id: string;
    sitterId?: string | null;
    displayName?: string | null;
    contractVersion?: string | null;
  } | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-CH", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(new Date(value))
    .replaceAll(".", "-");
}

function compareVersions(a: string | null | undefined, b: string | null | undefined) {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  return left.localeCompare(right, "fr-CH", { numeric: true, sensitivity: "base" });
}

export default function AdminContractAmendmentsClient() {
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [sitters, setSitters] = useState<SitterRow[]>([]);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/contract-amendments", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; amendments?: Amendment[]; sitters?: SitterRow[] } | null;
      if (!res.ok || !payload?.ok) {
        setError("Impossible de charger les avenants.");
        setLoading(false);
        return;
      }
      setAmendments(Array.isArray(payload.amendments) ? payload.amendments : []);
      setSitters(Array.isArray(payload.sitters) ? payload.sitters : []);
      setLoading(false);
    } catch {
      setError("Impossible de charger les avenants.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeAmendment = useMemo(() => amendments.find((item) => item.isActive) ?? null, [amendments]);

  async function createAmendment() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/contract-amendments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, version, content, isActive }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !payload?.ok) {
        setError("Impossible de créer l’avenant.");
        setSubmitting(false);
        return;
      }
      setTitle("");
      setVersion("");
      setContent("");
      setIsActive(true);
      setSuccess("Avenant enregistré.");
      await load();
    } catch {
      setError("Impossible de créer l’avenant.");
    } finally {
      setSubmitting(false);
    }
  }

  async function activateAmendment(id: string) {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/contract-amendments/${id}/activate`, { method: "POST" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !payload?.ok) {
        setError("Impossible d’activer l’avenant.");
        return;
      }
      setSuccess("Avenant activé.");
      await load();
    } catch {
      setError("Impossible d’activer l’avenant.");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Avenants</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Mises à jour contractuelles</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Active un avenant obligatoire pour suivre précisément quels sitters sont à jour et bloquer l’accès dashboard tant qu’il n’est pas accepté.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            Rafraîchir
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Créer un avenant</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Titre</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Version</span>
              <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex. 2026-03-24-avenant-1" className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900" />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              <span>Activer immédiatement cet avenant</span>
            </label>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Contenu</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900" />
          </label>
        </div>
        {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
        {success ? <p className="mt-4 text-sm font-medium text-emerald-700">{success}</p> : null}
        <button type="button" onClick={() => void createAmendment()} disabled={submitting} className="mt-5 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:opacity-60">
          {submitting ? "Enregistrement…" : "Créer l’avenant"}
        </button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">Historique des avenants</h3>
          {loading ? <p className="mt-4 text-sm text-slate-600">Chargement…</p> : (
            <div className="mt-5 grid gap-3">
              {amendments.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">Version {item.version}</p>
                      <p className="mt-1 text-xs text-slate-500">Créé le {formatDate(item.createdAt)}</p>
                    </div>
                    {item.isActive ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">Actif</span>
                    ) : (
                      <button type="button" onClick={() => void activateAmendment(item.id)} className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
                        Activer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">Suivi des sitters</h3>
          <p className="mt-2 text-sm text-slate-600">Statut d’acceptation pour l’avenant actif.</p>
          {activeAmendment ? (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Sitter</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold">Date d’acceptation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sitters.filter((row) => row.sitterProfile?.id).map((row) => {
                    const acceptance = activeAmendment.acceptances.find((entry) => entry.sitterProfile?.sitterId === row.sitterProfile?.sitterId && entry.amendmentVersion === activeAmendment.version);
                    const contractVersion = row.sitterProfile?.contractVersion ?? null;
                    const isCoveredByContract = compareVersions(contractVersion, activeAmendment.version) >= 0;
                    const isAccepted = Boolean(acceptance?.acceptedAt || isCoveredByContract);
                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-3 text-slate-900">{row.sitterProfile?.displayName || row.name || row.sitterProfile?.sitterId || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{row.email}</td>
                        <td className="px-4 py-3">
                          {isAccepted ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">Accepté ✅</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-900">En attente ❌</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{isCoveredByContract ? "Inclus dans le contrat" : formatDate(acceptance?.acceptedAt ?? null)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Aucun avenant actif pour le moment.</div>
          )}
        </div>
      </section>
    </div>
  );
}
