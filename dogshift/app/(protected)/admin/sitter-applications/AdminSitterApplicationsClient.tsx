"use client";

import { useEffect, useMemo, useState } from "react";

type AppStatus = "PENDING" | "CONTACTED" | "ACCEPTED" | "REJECTED";

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
  createdAt: string;
  updatedAt: string;
};

function statusLabel(status: AppStatus) {
  if (status === "PENDING") return "En attente";
  if (status === "CONTACTED") return "Contacté";
  if (status === "ACCEPTED") return "Accepté";
  return "Refusé";
}

function statusTone(status: AppStatus) {
  if (status === "ACCEPTED") return "border-emerald-200 bg-emerald-50 text-emerald-900";
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

  const [selectedId, setSelectedId] = useState<string>("");
  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  const [actionLoading, setActionLoading] = useState(false);

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

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(next: AppStatus) {
    if (!selected) return;
    if (actionLoading) return;
    setActionLoading(true);
    setError(null);
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
            <div className="mt-3 grid gap-2">
              {items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedId(a.id)}
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
                        onClick={() => void setStatus("REJECTED")}
                        className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                      >
                        Refusé
                      </button>
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
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
