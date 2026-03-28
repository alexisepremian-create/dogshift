"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type VerificationItem = {
  sitterProfileId: string;
  userId: string | null;
  sitterId: string;
  name: string | null;
  email: string | null;
  city: string | null;
  postalCode: string | null;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  notes: string | null;
  idDocumentKey: string | null;
  selfieKey: string | null;
};

type Tab = "all" | "pending" | "approved" | "rejected";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "pending", label: "En attente" },
  { id: "approved", label: "Approuvées" },
  { id: "rejected", label: "Refusées" },
];

function statusBadge(status: string) {
  if (status === "pending")
    return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">En attente</span>;
  if (status === "approved")
    return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">Approuvée</span>;
  if (status === "rejected")
    return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">Refusée</span>;
  return <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{status}</span>;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(d);
}

export default function AdminVerificationsClient() {
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [presignedUrls, setPresignedUrls] = useState<Record<string, string>>({});
  const [presignLoading, setPresignLoading] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/verifications");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Erreur inconnue");
      setItems(data.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((i) => i.status === tab);
  }, [items, tab]);

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  }), [items]);

  async function handleAction(item: VerificationItem, action: "approve" | "reject") {
    if (!item.userId || actionLoading) return;
    const label = action === "approve" ? "approuver" : "refuser";
    if (!window.confirm(`Confirmer : ${label} la vérification de ${item.name ?? item.email ?? item.sitterId} ?`)) return;

    setActionLoading(item.sitterProfileId);
    try {
      const res = await fetch(`/api/admin/sitters/${item.userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Erreur");
      await fetchItems();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePresign(sitterId: string, fileKey: string) {
    if (presignedUrls[fileKey]) {
      window.open(presignedUrls[fileKey], "_blank");
      return;
    }
    setPresignLoading(fileKey);
    try {
      const res = await fetch("/api/admin/verifications/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitterId, fileKey }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Erreur");
      setPresignedUrls((prev) => ({ ...prev, [fileKey]: data.url }));
      window.open(data.url, "_blank");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Impossible de charger le document");
    } finally {
      setPresignLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--dogshift-blue)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">{error}</p>
        <button onClick={() => void fetchItems()} className="mt-3 text-sm font-semibold text-red-600 underline hover:text-red-800">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "rounded-2xl border px-4 py-3 text-left transition " +
              (tab === t.id
                ? "border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300")
            }
          >
            <p className="text-2xl font-bold tracking-tight text-slate-900">{counts[t.id]}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{t.label}</p>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            Aucune demande de vérification {tab !== "all" ? `avec le statut « ${TABS.find((t) => t.id === tab)?.label} »` : ""}.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const isExpanded = expanded === item.sitterProfileId;
              const isActioning = actionLoading === item.sitterProfileId;

              return (
                <div key={item.sitterProfileId}>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : item.sitterProfileId)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {item.name ?? "Sans nom"}{" "}
                        <span className="font-normal text-slate-400">{item.email ? `— ${item.email}` : ""}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.city ?? ""}{item.postalCode ? ` (${item.postalCode})` : ""}{" · "}
                        Soumis le {formatDate(item.submittedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {statusBadge(item.status)}
                      <svg
                        className={`h-4 w-4 text-slate-400 transition ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Details */}
                        <div className="space-y-2 text-sm">
                          <p><span className="font-medium text-slate-500">Sitter ID :</span> <span className="font-mono text-xs text-slate-700">{item.sitterId}</span></p>
                          <p><span className="font-medium text-slate-500">Statut :</span> {statusBadge(item.status)}</p>
                          <p><span className="font-medium text-slate-500">Soumis :</span> {formatDate(item.submittedAt)}</p>
                          {item.reviewedAt && <p><span className="font-medium text-slate-500">Examiné :</span> {formatDate(item.reviewedAt)}</p>}
                          {item.notes && <p><span className="font-medium text-slate-500">Notes :</span> <span className="text-slate-700">{item.notes}</span></p>}
                        </div>

                        {/* Documents */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Documents</p>
                          {item.idDocumentKey ? (
                            <button
                              onClick={() => void handlePresign(item.sitterId, item.idDocumentKey!)}
                              disabled={presignLoading === item.idDocumentKey}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              {presignLoading === item.idDocumentKey ? "Chargement…" : "Pièce d'identité"}
                            </button>
                          ) : (
                            <p className="text-xs text-slate-400">Aucune pièce d'identité</p>
                          )}
                          {item.selfieKey ? (
                            <button
                              onClick={() => void handlePresign(item.sitterId, item.selfieKey!)}
                              disabled={presignLoading === item.selfieKey}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              {presignLoading === item.selfieKey ? "Chargement…" : "Selfie de vérification"}
                            </button>
                          ) : (
                            <p className="text-xs text-slate-400">Aucun selfie</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4">
                        {(item.status === "pending" || item.status === "rejected" || item.status === "not_verified") && (
                          <button
                            onClick={() => void handleAction(item, "approve")}
                            disabled={isActioning || !item.userId}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {isActioning ? "…" : "Approuver"}
                          </button>
                        )}
                        {(item.status === "pending" || item.status === "approved") && (
                          <button
                            onClick={() => void handleAction(item, "reject")}
                            disabled={isActioning || !item.userId}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                          >
                            {isActioning ? "…" : "Refuser"}
                          </button>
                        )}
                        {!item.userId && (
                          <p className="text-xs text-red-500">Utilisateur introuvable — action impossible</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
