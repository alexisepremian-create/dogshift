"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const DOG_SIZES = ["Petit", "Moyen", "Grand"] as const;
type DogSize = (typeof DOG_SIZES)[number];

type PensionVerifItem = {
  sitterProfileId: string;
  sitterId: string;
  name: string | null;
  email: string | null;
  city: string | null;
  status: string;
  photoCount: number;
  photoKeys: string[];
  submittedAt: string | null;
  adminNotes: string | null;
  pensionAcceptedSizes: string[];
  housingType: string | null;
  hasGarden: boolean | null;
};

type Tab = "all" | "legacy_pending" | "pending" | "ai_needs_review" | "approved" | "rejected";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "legacy_pending", label: "Legacy en attente" },
  { id: "pending", label: "En attente" },
  { id: "ai_needs_review", label: "À réviser" },
  { id: "approved", label: "Approuvé" },
  { id: "rejected", label: "Refusé" },
];

/** Auto-suggest accepted sizes based on housing context */
function suggestSizes(housingType: string | null, hasGarden: boolean | null): DogSize[] {
  if (housingType === "Maison" && hasGarden) return ["Petit", "Moyen", "Grand"];
  if (housingType === "Maison") return ["Petit", "Moyen"];
  if (housingType === "Appartement" && hasGarden) return ["Petit", "Moyen"];
  if (housingType === "Appartement") return ["Petit"];
  return ["Petit"];
}

function statusBadge(status: string) {
  switch (status) {
    case "legacy_pending":
      return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">Legacy — en attente</span>;
    case "pending":
      return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">En attente</span>;
    case "ai_reviewing":
      return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">En attente</span>;
    case "ai_needs_review":
      return <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 ring-1 ring-purple-200">À réviser</span>;
    case "ai_approved":
    case "approved":
      return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">Approuvé ✓</span>;
    case "ai_rejected":
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(d);
}

export default function AdminPensionVerificationsClient() {
  const [items, setItems] = useState<PensionVerifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [presignedUrls, setPresignedUrls] = useState<Record<string, string>>({});
  const [presignLoading, setPresignLoading] = useState<Set<string>>(new Set());
  const [adminNotesInput, setAdminNotesInput] = useState<Record<string, string>>({});
  const [selectedSizes, setSelectedSizes] = useState<Record<string, DogSize[]>>({});
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [sizesUpdateLoading, setSizesUpdateLoading] = useState<string | null>(null);
  const [sizesUpdateSuccess, setSizesUpdateSuccess] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pension-verifications");
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Erreur inconnue");
      const fetched: PensionVerifItem[] = data.items ?? [];
      setItems(fetched);
      // Pre-populate size selections: if already approved use saved sizes, else suggest from housing
      setSelectedSizes((prev) => {
        const next = { ...prev };
        for (const item of fetched) {
          if (!(item.sitterId in next)) {
            next[item.sitterId] =
              item.pensionAcceptedSizes.length > 0
                ? (item.pensionAcceptedSizes as DogSize[])
                : suggestSizes(item.housingType, item.hasGarden);
          }
        }
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    if (tab === "approved") return items.filter((i) => i.status === "approved" || i.status === "ai_approved");
    if (tab === "rejected") return items.filter((i) => i.status === "rejected" || i.status === "ai_rejected");
    if (tab === "pending") return items.filter((i) => i.status === "pending" || i.status === "ai_reviewing");
    return items.filter((i) => i.status === tab);
  }, [items, tab]);

  const counts = useMemo(() => ({
    all: items.length,
    legacy_pending: items.filter((i) => i.status === "legacy_pending").length,
    pending: items.filter((i) => i.status === "pending" || i.status === "ai_reviewing").length,
    ai_needs_review: items.filter((i) => i.status === "ai_needs_review").length,
    approved: items.filter((i) => i.status === "approved" || i.status === "ai_approved").length,
    rejected: items.filter((i) => i.status === "rejected" || i.status === "ai_rejected").length,
  }), [items]);

  async function loadPhotoUrl(key: string) {
    if (presignedUrls[key] || presignLoading.has(key)) return;
    setPresignLoading((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/admin/pension-verifications/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey: key }),
      });
      const data = await res.json();
      if (data.ok && data.url) {
        setPresignedUrls((prev) => ({ ...prev, [key]: data.url }));
      }
    } finally {
      setPresignLoading((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  function handleExpand(id: string, photoKeys: string[]) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    for (const k of photoKeys) { void loadPhotoUrl(k); }
  }

  function toggleSize(sitterId: string, size: DogSize) {
    setSelectedSizes((prev) => {
      const current = prev[sitterId] ?? [];
      const next = current.includes(size)
        ? current.filter((s) => s !== size)
        : [...current, size];
      return { ...prev, [sitterId]: next };
    });
  }

  async function handleReview(item: PensionVerifItem, decision: "approved" | "rejected") {
    if (actionLoading) return;
    const sizes = selectedSizes[item.sitterId] ?? [];
    if (decision === "approved" && sizes.length === 0) {
      alert("Veuillez sélectionner au moins une taille de chien acceptée avant d'approuver.");
      return;
    }
    const label = decision === "approved" ? "approuver" : "refuser";
    if (!window.confirm(`Confirmer : ${label} la pension de ${item.name ?? item.email ?? item.sitterId} ?`)) return;

    setActionLoading(item.sitterId + decision);
    try {
      const res = await fetch("/api/admin/pension-verifications/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sitterId: item.sitterId,
          decision,
          notes: adminNotesInput[item.sitterId] ?? null,
          pensionAcceptedSizes: decision === "approved" ? sizes : [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(`Erreur : ${data.error ?? "inconnue"}`);
        return;
      }
      await fetchItems();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateSizes(item: PensionVerifItem) {
    const sizes = selectedSizes[item.sitterId] ?? [];
    if (sizes.length === 0) {
      alert("Veuillez sélectionner au moins une taille.");
      return;
    }
    setSizesUpdateLoading(item.sitterId);
    setSizesUpdateSuccess(null);
    try {
      const res = await fetch("/api/admin/pension-verifications/update-sizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitterId: item.sitterId, pensionAcceptedSizes: sizes }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(`Erreur : ${data.error ?? "inconnue"}`);
        return;
      }
      setSizesUpdateSuccess(item.sitterId);
      setTimeout(() => setSizesUpdateSuccess(null), 3000);
      setItems((prev) =>
        prev.map((i) =>
          i.sitterId === item.sitterId ? { ...i, pensionAcceptedSizes: sizes } : i
        )
      );
    } finally {
      setSizesUpdateLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8">
        <p className="text-sm text-slate-500">Chargement…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
        <p className="text-sm font-semibold text-red-700">{error}</p>
        <button onClick={() => void fetchItems()} className="mt-3 text-sm text-red-600 underline">Réessayer</button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
            {counts[t.id] ? (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === t.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                {counts[t.id]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune demande dans cette catégorie.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map((item) => {
            const sizes = selectedSizes[item.sitterId] ?? suggestSizes(item.housingType, item.hasGarden);
            const isApproved = item.status === "approved" || item.status === "ai_approved";
            const isRejected = item.status === "rejected" || item.status === "ai_rejected";

            return (
              <div key={item.sitterProfileId} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.name ?? "—"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.email ?? "—"} · {item.city ?? "—"}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Sitter ID: {item.sitterId}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {statusBadge(item.status)}
                      <span className="text-xs text-slate-400">{item.photoCount} photo(s)</span>
                      <span className="text-xs text-slate-400">Soumis: {formatDate(item.submittedAt)}</span>
                      {item.housingType && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {item.housingType}{item.hasGarden ? " + jardin" : ""}
                        </span>
                      )}
                    </div>
                    {isApproved && item.pensionAcceptedSizes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.pensionAcceptedSizes.map((s) => (
                          <span key={s} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.photoCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleExpand(item.sitterProfileId, item.photoKeys)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {expanded === item.sitterProfileId ? "Fermer" : "Voir photos"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleReview(item, "approved")}
                      disabled={!!actionLoading || isApproved}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionLoading === item.sitterId + "approved" ? "…" : "Approuver"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReview(item, "rejected")}
                      disabled={!!actionLoading || isRejected}
                      className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading === item.sitterId + "rejected" ? "…" : "Refuser"}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded === item.sitterProfileId && (
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-4">
                    {/* Photos */}
                    {item.photoKeys.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Photos du logement</p>
                        <div className="flex flex-wrap gap-3">
                          {item.photoKeys.map((key, idx) => {
                            const allUrls = item.photoKeys.map((k) => presignedUrls[k]).filter(Boolean);
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  if (presignedUrls[key] && allUrls.length > 0) {
                                    setLightbox({ urls: allUrls, index: allUrls.indexOf(presignedUrls[key]) });
                                  }
                                }}
                                className="h-28 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 cursor-zoom-in hover:opacity-90 transition"
                                title={`Photo ${idx + 1} — cliquer pour agrandir`}
                              >
                                {presignedUrls[key] ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={presignedUrls[key]} alt={`Photo logement ${idx + 1}`} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                                    {presignLoading.has(key) ? "…" : "Erreur"}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Dog size acceptance (shown when reviewing or already approved) */}
                    {!isRejected && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Tailles de chiens acceptées
                          {!isApproved && item.housingType && (
                            <span className="ml-2 font-normal normal-case text-slate-400">
                              (suggestion basée sur : {item.housingType}{item.hasGarden ? " + jardin" : ""})
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          {DOG_SIZES.map((size) => {
                            const checked = sizes.includes(size);
                            return (
                              <label
                                key={size}
                                className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition select-none ${
                                  checked
                                    ? isApproved
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      : "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={checked}
                                  onChange={() => toggleSize(item.sitterId, size)}
                                />
                                <span
                                  className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
                                    checked
                                      ? isApproved ? "border-emerald-400 bg-emerald-400" : "border-indigo-500 bg-indigo-500"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {checked && (
                                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="currentColor">
                                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </span>
                                {size}
                              </label>
                            );
                          })}

                          {isApproved && (
                            <button
                              type="button"
                              onClick={() => void handleUpdateSizes(item)}
                              disabled={sizesUpdateLoading === item.sitterId}
                              className="rounded-xl border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                            >
                              {sizesUpdateLoading === item.sitterId
                                ? "Sauvegarde…"
                                : sizesUpdateSuccess === item.sitterId
                                  ? "✓ Sauvegardé"
                                  : "Mettre à jour"}
                            </button>
                          )}
                        </div>
                        {!isApproved && (
                          <p className="mt-1.5 text-[11px] text-slate-400">Ces tailles seront sauvegardées et affichées sur le profil public lors de l&#39;approbation.</p>
                        )}
                        {isApproved && (
                          <p className="mt-1.5 text-[11px] text-slate-400">Modifie les tailles puis clique sur &quot;Mettre à jour&quot; — le profil du sitter sera immédiatement restreint.</p>
                        )}
                      </div>
                    )}

                    {/* Admin notes */}
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes admin</p>
                      {item.adminNotes && (
                        <p className="mb-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-800">{item.adminNotes}</p>
                      )}
                      <textarea
                        rows={2}
                        value={adminNotesInput[item.sitterId] ?? ""}
                        onChange={(e) => setAdminNotesInput((prev) => ({ ...prev, [item.sitterId]: e.target.value }))}
                        placeholder="Ajouter une note (optionnel)…"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox carousel */}
      {lightbox && (
        <LightboxCarousel
          urls={lightbox.urls}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function LightboxCarousel({
  urls,
  initialIndex,
  onClose,
}: {
  urls: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(Math.max(0, Math.min(initialIndex, urls.length - 1)));

  const prev = () => setIdx((i) => (i - 1 + urls.length) % urls.length);
  const next = () => setIdx((i) => (i + 1) % urls.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white">
        {idx + 1} / {urls.length}
      </div>

      {urls.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[idx]}
        alt={`Photo ${idx + 1}`}
        className="max-h-[88vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {urls.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {urls.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
          {urls.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              className={`h-2 w-2 rounded-full transition ${i === idx ? "bg-white scale-125" : "bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
