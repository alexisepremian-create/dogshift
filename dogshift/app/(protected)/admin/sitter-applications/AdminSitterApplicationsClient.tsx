"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AdminNotesPanel from "@/components/admin/AdminNotesPanel";
import type { SitterLifecycleStatus } from "@/lib/sitterContract";

type AppStatus = "PENDING" | "CONTACTED" | "ACCEPTED" | "ACTIVATED" | "REJECTED";

type ApplicationItem = {
  id: string;
  firstName: string;
  lastName: string;
  city: string;
  email: string;
  phone: string;
  age: number | null;
  experienceText: string;
  hasDogExperience: boolean;
  motivationText: string;
  availabilityText: string;
  consentInterview: boolean;
  consentPrivacy: boolean;
  status: AppStatus;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  userAgent: string | null;
  ip: string | null;
  linkedUserId: string | null;
  sitterProfileId: string | null;
  sitterLifecycleStatus: SitterLifecycleStatus | null;
  contractAccessTokenIssuedAt: string | null;
  contractAccessTokenExpiresAt: string | null;
  contractSignedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ContractDetailsPayload = {
  ok?: boolean;
  currentContract?: { title?: string; version?: string; content?: string };
  profile?: {
    userId?: string | null;
    sitterId?: string | null;
    profileId?: string;
    contractVersion?: string | null;
    contractAccessTokenVersion?: string | null;
    contractAccessTokenIssuedAt?: string | null;
    contractAccessTokenExpiresAt?: string | null;
    contractAccessTokenUsedAt?: string | null;
    contractSignerName?: string | null;
    contractSignedAt?: string | null;
    lifecycleStatus?: string | null;
    contractSnapshot?: any;
  } | null;
  error?: string;
};

function contractStatusLabel(item: ApplicationItem) {
  if (item.contractSignedAt || item.sitterLifecycleStatus === "contract_signed" || item.sitterLifecycleStatus === "activated") {
    return "contrat signé";
  }
  if (item.contractAccessTokenIssuedAt || item.sitterLifecycleStatus === "contract_to_sign") {
    return "contrat envoyé";
  }
  return "contrat non envoyé";
}

function statusLabel(status: AppStatus) {
  if (status === "PENDING") return "En attente";
  if (status === "CONTACTED") return "Contacté";
  if (status === "ACCEPTED") return "Accepté";
  if (status === "ACTIVATED") return "Activé";
  return "Refusé";
}

function statusTone(status: AppStatus) {
  if (status === "ACCEPTED") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "ACTIVATED") return "border-violet-200 bg-violet-50 text-violet-950";
  if (status === "CONTACTED") return "border-sky-200 bg-sky-50 text-sky-900";
  if (status === "REJECTED") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function formatFrCh(iso: string) {
  const dt = new Date(iso);
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(dt)
    .replaceAll(".", "-");
}

export default function AdminSitterApplicationsClient({ adminCode }: { adminCode?: string }) {
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AppStatus>("ALL");

  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationIdFromUrl = searchParams.get("applicationId") ?? "";

  const filteredItems = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = `${item.firstName} ${item.lastName} ${item.city}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, searchTerm, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: items.length };
    for (const it of items) {
      counts[it.status] = (counts[it.status] ?? 0) + 1;
    }
    return counts as Record<"ALL" | AppStatus, number>;
  }, [items]);

  const [selectedId, setSelectedId] = useState<string>(applicationIdFromUrl);
  useEffect(() => {
    if (applicationIdFromUrl && applicationIdFromUrl !== selectedId) {
      setSelectedId(applicationIdFromUrl);
    }
  }, [applicationIdFromUrl, selectedId]);
  const selected = useMemo(() => filteredItems.find((i) => i.id === selectedId) ?? items.find((i) => i.id === selectedId) ?? filteredItems[0] ?? null, [filteredItems, items, selectedId]);

  const [actionLoading, setActionLoading] = useState(false);
  const [contractActionLoading, setContractActionLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [contractDetails, setContractDetails] = useState<ContractDetailsPayload | null>(null);
  const [contractDetailsLoading, setContractDetailsLoading] = useState(false);
  const [contractModal, setContractModal] = useState<
    null | { kind: "current" | "signed"; title: string; version: string; content: string; meta?: ReactNode }
  >(null);

  function adminHeaders(base?: Record<string, string>) {
    return {
      ...(base ?? {}),
      ...(adminCode ? { "x-admin-code": adminCode } : {}),
    };
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pilot-sitter-applications", {
        method: "GET",
        headers: adminHeaders(),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || !Array.isArray(payload?.applications)) {
        setError("Impossible de charger les candidatures.");
        return;
      }
      const rows = payload.applications as ApplicationItem[];
      setItems(rows);
      if (rows.length && !selectedId) setSelectedId(rows[0].id);
    } catch {
      setError("Impossible de charger les candidatures.");
    } finally {
      setLoading(false);
    }
  }

  async function sendContract() {
    const item = selected;
    const canSend = Boolean(item) && (item.status === "ACCEPTED" || item.status === "ACTIVATED");
    if (!canSend || contractActionLoading) return;
    setContractActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/pilot-sitter-applications/contract", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: selected.id }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        if (payload?.error === "CONTRACT_LINK_INVALID_STATE") {
          setError("Renvoi impossible: état du profil incohérent pour la gestion du contrat.");
        } else {
          setError("Impossible d’envoyer le contrat.");
        }
        return;
      }
      setSuccess("Contrat envoyé avec lien sécurisé.");
      await load();
    } catch {
      setError("Impossible d’envoyer le contrat.");
    } finally {
      setContractActionLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!selected?.id) {
      setContractDetails(null);
      return;
    }

    void (async () => {
      try {
        setContractDetailsLoading(true);
        const res = await fetch(`/api/admin/pilot-sitter-applications/contract-details?applicationId=${encodeURIComponent(selected.id)}`, {
          method: "GET",
          headers: adminHeaders(),
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as ContractDetailsPayload | null;
        if (cancelled) return;
        if (!res.ok || !payload?.ok) {
          setContractDetails({ ok: false, error: payload?.error || "LOAD_FAILED" });
          return;
        }
        setContractDetails(payload);
      } catch {
        if (cancelled) return;
        setContractDetails({ ok: false, error: "LOAD_FAILED" });
      } finally {
        if (!cancelled) setContractDetailsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adminCode, selected?.id]);

  function openCurrentContractPreview() {
    const current = contractDetails?.currentContract;
    const title = (current?.title ?? "").trim() || "Contrat dogsitter";
    const version = (current?.version ?? "").trim() || "—";
    const content = (current?.content ?? "").trim() || "";
    setContractModal({ kind: "current", title, version, content });
  }

  async function openSignedContractSnapshot() {
    // Refresh once at click-time so we don't depend on a potentially stale payload.
    let latest = contractDetails;
    if (selected?.id) {
      try {
        const res = await fetch(`/api/admin/pilot-sitter-applications/contract-details?applicationId=${encodeURIComponent(selected.id)}`, {
          method: "GET",
          headers: adminHeaders(),
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as ContractDetailsPayload | null;
        if (res.ok && payload?.ok) {
          latest = payload;
          setContractDetails(payload);
        }
      } catch {
        // keep latest (best effort)
      }
    }

    const profile = latest?.profile ?? null;
    const snap = profile?.contractSnapshot;
    const title = typeof snap?.title === "string" && snap.title.trim() ? snap.title.trim() : "Contrat signé";
    const version =
      (typeof snap?.version === "string" && snap.version.trim()) || (typeof profile?.contractVersion === "string" && profile.contractVersion.trim())
        ? (snap?.version as string) || (profile?.contractVersion as string)
        : "—";
    const content =
      typeof snap?.content === "string" ? snap.content : typeof latest?.currentContract?.content === "string" ? latest.currentContract.content : "";
    const signerName = typeof snap?.signerName === "string" ? snap.signerName : typeof profile?.contractSignerName === "string" ? profile.contractSignerName : null;
    const signedAt = typeof snap?.signedAt === "string" ? snap.signedAt : typeof profile?.contractSignedAt === "string" ? profile.contractSignedAt : null;

    const meta = (
      <div className="mt-3 grid gap-1 text-xs text-slate-600">
        {signerName ? (
          <p>
            <span className="font-semibold text-slate-900">Signé par :</span> {signerName}
          </p>
        ) : null}
        {signedAt ? (
          <p>
            <span className="font-semibold text-slate-900">Signé le :</span> {formatFrCh(signedAt)}
          </p>
        ) : null}
      </div>
    );

    setContractModal({ kind: "signed", title, version, content, meta });
  }

  async function setStatus(next: AppStatus) {
    if (!selected) return;
    if (actionLoading) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/pilot-sitter-applications/status", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: selected.id, status: next }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        setError("Impossible d’enregistrer le statut.");
        return;
      }
      await load();
    } catch {
      setError("Impossible d’enregistrer le statut.");
    } finally {
      setActionLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.20)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Candidatures (phase pilote)</h2>
          <p className="mt-2 text-sm text-slate-600">Sélection manuelle. Statut modifiable.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          Rafraîchir
        </button>
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="mt-4 text-sm font-medium text-emerald-700">{success}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-600">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Aucune candidature</p>
          <p className="mt-2 text-sm text-slate-600">Tout est à jour.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Liste</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { key: "ALL" as const, label: "Toutes" },
                  { key: "PENDING" as const, label: "En attente" },
                  { key: "CONTACTED" as const, label: "Contactées" },
                  { key: "ACCEPTED" as const, label: "Acceptées" },
                  { key: "ACTIVATED" as const, label: "Activées" },
                  { key: "REJECTED" as const, label: "Refusées" },
                ] as const
              ).map((opt) => {
                const active = statusFilter === opt.key;
                const count = statusCounts[opt.key] ?? 0;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setStatusFilter(opt.key)}
                    className={
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition " +
                      (active
                        ? "border-[var(--dogshift-blue)] bg-white text-[var(--dogshift-blue)]"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                    }
                  >
                    <span>{opt.label}</span>
                    <span className={"rounded-full px-2 py-0.5 text-[11px] " + (active ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_86%)]" : "bg-slate-100")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="relative mt-3">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.1667 14.1667L17.5 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="8.75" cy="8.75" r="5.83333" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom ou ville…"
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </div>
            <div className="mt-3 grid gap-2">
              {filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm font-medium text-slate-600">
                  Aucun candidat trouvé
                </div>
              ) : filteredItems.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(a.id);
                    const next = new URLSearchParams(searchParams.toString());
                    next.set("applicationId", a.id);
                    void router.push(`/admin/sitters/applications?${next.toString()}`);
                  }}
                  className={
                    "w-full rounded-2xl border px-4 py-3 text-left transition " +
                    (a.id === selectedId ? "border-[var(--dogshift-blue)] bg-white" : "border-slate-200 bg-white hover:bg-slate-50")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{a.firstName} {a.lastName}</p>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(a.status)}`}>{statusLabel(a.status)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{a.city}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatFrCh(a.createdAt)}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{selected.firstName} {selected.lastName}</p>
                    <p className="mt-1 text-sm text-slate-600">{selected.city}</p>
                    <div className="mt-3 grid gap-1 text-sm text-slate-700">
                      <button type="button" onClick={() => void copy(selected.email)} className="text-left font-semibold text-[var(--dogshift-blue)]">{selected.email}</button>
                      <button type="button" onClick={() => void copy(selected.phone)} className="text-left font-semibold text-[var(--dogshift-blue)]">{selected.phone}</button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(selected.status)}`}>{statusLabel(selected.status)}</span>
                    <p className="text-xs text-slate-500">Reçu: {formatFrCh(selected.createdAt)}</p>
                    <p className="text-xs text-slate-500">{contractStatusLabel(selected)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Expérience</p>
                    <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{selected.experienceText}</p>
                    <p className="mt-2 text-xs text-slate-600">A déjà gardé des chiens: {selected.hasDogExperience ? "Oui" : "Non"}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Motivation</p>
                    <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{selected.motivationText}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Disponibilités</p>
                    <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{selected.availabilityText}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-700">Statut</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void setStatus("PENDING")}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        En attente
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void setStatus("CONTACTED")}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        Contacté
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void setStatus("ACCEPTED")}
                        className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Accepté
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void setStatus("ACTIVATED")}
                        className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                      >
                        Activé
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void setStatus("REJECTED")}
                        className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                      >
                        Refusé
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Gestion du contrat</p>
                        <p className="mt-1 text-sm text-slate-600">Prévisualisation du contrat actuel + accès au contrat signé.</p>
                      </div>
                      <button
                        type="button"
                        disabled={(selected.status !== "ACCEPTED" && selected.status !== "ACTIVATED") || contractActionLoading}
                        onClick={() => void sendContract()}
                        className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {contractActionLoading ? "En cours…" : selected.contractAccessTokenIssuedAt ? "Renvoyer le contrat" : "Envoyer le contrat"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">Contrat actuel</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Version : {contractDetails?.currentContract?.version ?? "—"}
                              {contractDetailsLoading ? " (chargement…)" : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={contractDetailsLoading || !(contractDetails?.currentContract?.content || "").trim()}
                            onClick={() => openCurrentContractPreview()}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Prévisualiser le contrat
                          </button>
                        </div>
                        <p className="mt-3 text-xs text-slate-600">
                          Le contenu affiché correspond au modèle actuellement actif (celui qui serait envoyé aujourd’hui).
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">Contrats envoyés / signés</p>
                            <p className="mt-1 text-xs text-slate-500">Statut : {contractStatusLabel(selected)}.</p>
                          </div>
                          <button
                            type="button"
                            disabled={
                              !contractDetails?.profile?.contractSignedAt &&
                              contractDetails?.profile?.lifecycleStatus !== "contract_signed"
                            }
                            onClick={() => void openSignedContractSnapshot()}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Voir le contrat signé
                          </button>
                        </div>

                        <div className="mt-3 grid gap-1 text-xs text-slate-600">
                          {selected.sitterLifecycleStatus ? <p>Lifecycle sitter : {selected.sitterLifecycleStatus}.</p> : null}
                          {selected.contractAccessTokenIssuedAt ? <p>Lien envoyé le : {formatFrCh(selected.contractAccessTokenIssuedAt)}.</p> : null}
                          {selected.contractAccessTokenExpiresAt ? <p>Expiration prévue le : {formatFrCh(selected.contractAccessTokenExpiresAt)}.</p> : null}
                          {selected.contractSignedAt ? <p>Contrat signé le : {formatFrCh(selected.contractSignedAt)}.</p> : null}
                          {selected.status !== "ACCEPTED" && selected.status !== "ACTIVATED" ? (
                            <p>Le contrat est disponible après acceptation ou activation de la candidature.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-700">Tracking (si dispo)</p>
                    <div className="mt-2 grid gap-1 text-xs text-slate-600">
                      <p>utm_source: {selected.utmSource ?? "—"}</p>
                      <p>utm_campaign: {selected.utmCampaign ?? "—"}</p>
                      <p>referrer: {selected.referrer ?? "—"}</p>
                    </div>
                  </div>

                  <AdminNotesPanel targetType="PILOT_SITTER_APPLICATION" targetId={selected.id} title="Notes internes – candidature" />
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {contractModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-600">Contrat dogsitter</p>
                <p className="mt-1 truncate text-base font-semibold text-slate-900">{contractModal.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">Version : {contractModal.version}</span>
                  {contractModal.kind === "signed" ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-900">
                      Snapshot signé (figé)
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-semibold text-sky-900">
                      Contrat actuel (prévisualisation)
                    </span>
                  )}
                </div>
                {contractModal.meta ?? null}
              </div>
              <button
                type="button"
                onClick={() => setContractModal(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto px-6 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{contractModal.content}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setContractModal(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
