"use client";

import { useEffect, useMemo, useState } from "react";

type PendingItem = {
  sitterProfileId: string;
  sitterId: string;
  name: string | null;
  email: string | null;
  city: string | null;
  postalCode: string | null;
  submittedAt: string | null;
  idDocumentKey: string | null;
  selfieKey: string | null;
};

function StatusPill({ status }: { status: "pending" | "approved" | "rejected" | "not_verified" }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
        Approuvé
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm">
        En cours
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 shadow-sm">
        Refusé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      Non vérifié
    </span>
  );
}

export default function AdminHostClient({ adminCode }: { adminCode: string }) {
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSitterId, setSelectedSitterId] = useState<string>("");
  const selected = useMemo(() => pending.find((p) => p.sitterId === selectedSitterId) ?? null, [pending, selectedSitterId]);

  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [idPreviewUrl, setIdPreviewUrl] = useState<string | null>(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);

  async function loadPending() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/verifications/pending", {
        method: "GET",
        headers: {
          "x-admin-code": adminCode,
        },
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || !Array.isArray(payload?.pending)) {
        setError("Impossible de charger les demandes.");
        return;
      }
      const rows = payload.pending as PendingItem[];
      setPending(rows);
      if (rows.length && !selectedSitterId) {
        setSelectedSitterId(rows[0].sitterId);
      }
    } catch {
      setError("Impossible de charger les demandes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIdPreviewUrl(null);
    setSelfiePreviewUrl(null);
    setNotes("");
  }, [selectedSitterId]);

  async function presign(fileKey: string) {
    const res = await fetch("/api/admin/verifications/presign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-code": adminCode,
      },
      body: JSON.stringify({ sitterId: selectedSitterId, fileKey }),
    });
    const payload = (await res.json().catch(() => null)) as any;
    if (!res.ok || !payload?.ok || typeof payload?.url !== "string") {
      throw new Error("PRESIGN_FAILED");
    }
    return payload.url as string;
  }

  async function review(decision: "approved" | "rejected") {
    if (!selected) return;
    if (actionLoading) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/verifications/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-code": adminCode,
        },
        body: JSON.stringify({ sitterId: selected.sitterId, decision, notes }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        setError("Impossible d’enregistrer la décision.");
        return;
      }
      await loadPending();
      setIdPreviewUrl(null);
      setSelfiePreviewUrl(null);
      setNotes("");
    } catch {
      setError("Impossible d’enregistrer la décision.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.25)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Vérification Host</h2>
          <p className="mt-2 text-sm text-slate-600">Demandes en attente + preview via URL présignée (60s).</p>
        </div>
        <button
          type="button"
          onClick={() => void loadPending()}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          Rafraîchir
        </button>
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-600">Chargement…</p>
      ) : pending.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Aucune demande en attente</p>
          <p className="mt-2 text-sm text-slate-600">Tout est à jour.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Demandes</p>
            <div className="mt-3 grid gap-2">
              {pending.map((p) => (
                <button
                  key={p.sitterId}
                  type="button"
                  onClick={() => setSelectedSitterId(p.sitterId)}
                  className={
                    "w-full rounded-2xl border px-4 py-3 text-left transition " +
                    (p.sitterId === selectedSitterId
                      ? "border-[var(--dogshift-blue)] bg-white"
                      : "border-slate-200 bg-white hover:bg-slate-50")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{p.name ?? p.sitterId}</p>
                    <StatusPill status="pending" />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{p.email ?? ""}</p>
                  <p className="mt-1 text-xs text-slate-500">{p.submittedAt ? new Date(p.submittedAt).toLocaleString() : ""}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selected.name ?? selected.sitterId}</p>
                    <p className="mt-1 text-xs text-slate-600">{selected.email ?? ""}</p>
                  </div>
                  <StatusPill status="pending" />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Pièce d’identité</p>
                    <button
                      type="button"
                      disabled={actionLoading || !selected.idDocumentKey}
                      onClick={async () => {
                        if (!selected.idDocumentKey) return;
                        try {
                          const url = await presign(selected.idDocumentKey);
                          setIdPreviewUrl(url);
                        } catch {
                          setError("Preview impossible.");
                        }
                      }}
                      className="mt-3 inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Générer un lien (60s)
                    </button>
                    {idPreviewUrl ? (
                      <a
                        href={idPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block text-xs font-semibold text-[var(--dogshift-blue)]"
                      >
                        Ouvrir le document
                      </a>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Selfie</p>
                    <button
                      type="button"
                      disabled={actionLoading || !selected.selfieKey}
                      onClick={async () => {
                        if (!selected.selfieKey) return;
                        try {
                          const url = await presign(selected.selfieKey);
                          setSelfiePreviewUrl(url);
                        } catch {
                          setError("Preview impossible.");
                        }
                      }}
                      className="mt-3 inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Générer un lien (60s)
                    </button>
                    {selfiePreviewUrl ? (
                      <a
                        href={selfiePreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block text-xs font-semibold text-[var(--dogshift-blue)]"
                      >
                        Ouvrir le selfie
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5">
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="admin_verification_notes">
                    Notes (optionnel)
                  </label>
                  <textarea
                    id="admin_verification_notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-2 w-full min-h-[110px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                    placeholder="ex. Document illisible / nom différent / etc."
                  />
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void review("approved")}
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approuver
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void review("rejected")}
                    className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Refuser
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
