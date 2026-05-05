"use client";

import { useCallback, useEffect, useState } from "react";

type CertItem = {
  sitterProfileId: string;
  sitterId: string;
  name: string | null;
  email: string | null;
  city: string | null;
  status: string;
  photoKey: string | null;
  maxDogs: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
};

type Tab = "all" | "pending" | "approved" | "rejected";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "pending", label: "En attente" },
  { id: "approved", label: "Approuvés" },
  { id: "rejected", label: "Refusés" },
];

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">En attente</span>;
    case "approved":
      return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">Approuvé ✓</span>;
    case "rejected":
      return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">Refusé</span>;
    default:
      return <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{status}</span>;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-CH", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich",
  }).format(d);
}

export default function AdminMaxDogsCertsClient() {
  const [items, setItems] = useState<CertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [selected, setSelected] = useState<CertItem | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [docLoading, setDocLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/max-dogs-certs");
      const data = (await res.json()) as { ok?: boolean; items?: CertItem[] };
      if (data.ok && Array.isArray(data.items)) setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openDoc = useCallback(async (photoKey: string) => {
    setDocLoading(true);
    try {
      const res = await fetch("/api/admin/max-dogs-certs/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey: photoKey }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string };
      if (data.ok && data.url) {
        window.open(data.url, "_blank");
      }
    } finally {
      setDocLoading(false);
    }
  }, []);

  const review = useCallback(async (decision: "approved" | "rejected") => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/max-dogs-certs/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitterId: selected.sitterId, decision, notes }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        setSelected(null);
        setNotes("");
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  }, [selected, notes, load]);

  const filtered = tab === "all" ? items : items.filter((i) => i.status === tab);

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = t.id === "all" ? items.length : items.filter((i) => i.status === t.id).length;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                tab === t.id ? "bg-slate-900 text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs font-bold ${tab === t.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">Aucun certificat dans cette catégorie.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.sitterId}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 truncate">{item.name ?? item.sitterId}</p>
                  {statusBadge(item.status)}
                  {item.maxDogs != null && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                      🐶 Max. {item.maxDogs} chiens
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {item.email ?? "—"} · {item.city ?? "—"} · Soumis {formatDate(item.submittedAt)}
                </p>
                {item.adminNotes && (
                  <p className="mt-1 text-xs text-slate-600 italic">{item.adminNotes}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setSelected(item); setNotes(item.adminNotes ?? ""); }}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Réviser
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Review panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setSelected(null); }}>
          <div
            className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-slate-900 mb-1">Certificat OPAn — {selected.name ?? selected.sitterId}</h2>
            <p className="text-xs text-slate-500 mb-4">
              {selected.email} · Max. {selected.maxDogs ?? "?"} chiens · Soumis {formatDate(selected.submittedAt)}
            </p>

            {/* Document viewer */}
            {selected.photoKey ? (
              <button
                type="button"
                disabled={docLoading}
                onClick={() => void openDoc(selected.photoKey!)}
                className="mb-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {docLoading ? "Chargement…" : "📄 Ouvrir le document"}
              </button>
            ) : (
              <p className="mb-4 text-xs text-rose-600">Aucun document soumis.</p>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note admin (optionnel)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Motif de refus, remarque…"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void review("approved")}
                className="flex-1 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50"
              >
                ✅ Approuver
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void review("rejected")}
                className="flex-1 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-rose-700 disabled:opacity-50"
              >
                ❌ Refuser
              </button>
              <button
                type="button"
                onClick={() => { setSelected(null); }}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
