"use client";

import {
  DndContext,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { RequestDetailPanel } from "./RequestDetailPanel";
import { RequestListItem, type HostRequest } from "./RequestListItem";

type FilterKey = "ALL" | "TO_ACCEPT" | "CONFIRMED" | "CANCELLED" | "ARCHIVED";

function filterLabel(key: FilterKey) {
  if (key === "TO_ACCEPT") return "En attente d’acceptation";
  if (key === "CONFIRMED") return "Confirmées";
  if (key === "CANCELLED") return "Terminées";
  if (key === "ARCHIVED") return "Archivées";
  return "Tous";
}

function filterMatches(key: FilterKey, status: string) {
  if (key === "ALL") return true;
  if (key === "TO_ACCEPT") return status === "PENDING_ACCEPTANCE" || status === "PAID";
  if (key === "CONFIRMED") return status === "CONFIRMED";
  if (key === "CANCELLED") return status === "CANCELLED" || status === "REFUNDED" || status === "REFUND_FAILED";
  if (key === "ARCHIVED") return true;
  return true;
}

function matchesSearch(req: HostRequest, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const hay = `${req.owner.name} ${req.id}`.toLowerCase();
  return hay.includes(query);
}

export function RequestsSplitView({
  rows,
  loading,
  error,
  onRetry,
}: {
  rows: HostRequest[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localRows, setLocalRows] = useState<HostRequest[]>(rows);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [lastActiveFilter, setLastActiveFilter] = useState<Exclude<FilterKey, "ARCHIVED">>("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; undoId: string | null } | null>(null);
  const [undoing, setUndoing] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const pendingCount = useMemo(
    () =>
      localRows.filter(
        (b) =>
          !b.archivedAt &&
          (b.status === "PENDING_ACCEPTANCE" || b.status === "PAID")
      ).length,
    [localRows]
  );

  const isArchivedView = filter === "ARCHIVED";

  const filtered = useMemo(() => {
    return localRows
      .filter((r) => {
        const isArchived = Boolean(r.archivedAt);
        if (filter === "ARCHIVED") return isArchived;
        if (isArchived) return false;
        return filterMatches(filter, String(r.status));
      })
      .filter((r) => matchesSearch(r, search))
      .slice()
      .sort((a, b) => {
        const aToAccept = String(a.status) === "PENDING_ACCEPTANCE" || String(a.status) === "PAID";
        const bToAccept = String(b.status) === "PENDING_ACCEPTANCE" || String(b.status) === "PAID";
        if (aToAccept !== bToAccept) return aToAccept ? -1 : 1;

        const ta = new Date(a.updatedAt ?? a.createdAt).getTime();
        const tb = new Date(b.updatedAt ?? b.createdAt).getTime();
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
      });
  }, [localRows, filter, search]);

  const initialSelectedFromQuery = useMemo(() => {
    const q = searchParams?.get("id");
    return typeof q === "string" && q.trim() ? q.trim() : "";
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;
    if (filtered.length === 0) {
      setSelectedId(null);
      setMobileOpen(false);
      return;
    }

    const desired = initialSelectedFromQuery;
    if (desired && filtered.some((r) => r.id === desired)) {
      setSelectedId(desired);
      return;
    }

    if (!selectedId || !filtered.some((r) => r.id === selectedId)) {
      setSelectedId(filtered[0]!.id);
    }
  }, [filtered, initialSelectedFromQuery, loading, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("id", selectedId);
    router.replace(`/host/requests?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function hardDelete(bookingId: string) {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/host/requests/${encodeURIComponent(bookingId)}`, { method: "DELETE" });
      const payload = (await res.json()) as { ok?: boolean; deleted?: number; error?: string };
      if (!res.ok || !payload.ok) {
        setToast({ message: "Impossible de supprimer.", undoId: null });
        return;
      }
      setLocalRows((prev) => prev.filter((r) => r.id !== bookingId));
      setToast({ message: "Demande supprimée", undoId: null });
      setConfirmDeleteId(null);
    } catch {
      setToast({ message: "Impossible de supprimer.", undoId: null });
    } finally {
      setDeleting(false);
    }
  }

  const selected = useMemo(() => (selectedId ? filtered.find((r) => r.id === selectedId) ?? null : null), [filtered, selectedId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function archive(bookingId: string) {
    const nowIso = new Date().toISOString();
    setLocalRows((prev) => prev.map((r) => (r.id === bookingId ? { ...r, archivedAt: nowIso } : r)));
    setToast({ message: "Demande archivée", undoId: bookingId });

    try {
      const res = await fetch(`/api/host/requests/${encodeURIComponent(bookingId)}/archive`, { method: "POST" });
      const payload = (await res.json()) as { ok?: boolean; archivedAt?: string; error?: string };
      if (!res.ok || !payload.ok) {
        setLocalRows((prev) => prev.map((r) => (r.id === bookingId ? { ...r, archivedAt: null } : r)));
        setToast({ message: "Impossible d’archiver.", undoId: null });
        return;
      }
      if (typeof payload.archivedAt === "string") {
        setLocalRows((prev) => prev.map((r) => (r.id === bookingId ? { ...r, archivedAt: payload.archivedAt } : r)));
      }
    } catch {
      setLocalRows((prev) => prev.map((r) => (r.id === bookingId ? { ...r, archivedAt: null } : r)));
      setToast({ message: "Impossible d’archiver.", undoId: null });
    }
  }

  async function unarchive(bookingId: string) {
    if (undoing) return;
    setUndoing(true);
    setLocalRows((prev) => prev.map((r) => (r.id === bookingId ? { ...r, archivedAt: null } : r)));
    try {
      await fetch(`/api/host/requests/${encodeURIComponent(bookingId)}/unarchive`, { method: "POST" });
    } finally {
      setUndoing(false);
      setToast(null);
    }
  }

  function canArchive(r: HostRequest) {
    const status = String(r.status);
    if (status === "CONFIRMED" || status === "PAID" || status === "PENDING_ACCEPTANCE") return false;
    return status === "CANCELLED" || status === "REFUNDED" || status === "REFUND_FAILED";
  }

  function ArchiveDropZone({ active }: { active: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: "archive" });
    const base =
      "fixed bottom-6 right-6 z-40 hidden lg:flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-150";
    const visible = active ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none";
    const over = isOver ? "border-rose-200 bg-rose-50 text-rose-900 shadow-md" : "";

    return (
      <div ref={setNodeRef} className={`${base} ${visible} ${over}`}>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M6 6l1 16h10l1-16" />
          </svg>
        </span>
        <div className="leading-tight">
          <p>Glisser ici pour archiver</p>
          <p className="text-xs font-medium text-slate-500">{isOver ? "Relâcher pour archiver" : ""}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => {
          const id = String(e.active.id);
          setDraggingId(id);
        }}
        onDragCancel={() => setDraggingId(null)}
        onDragEnd={(e: DragEndEvent) => {
          const id = String(e.active.id);
          setDraggingId(null);

          if (!e.over || String(e.over.id) !== "archive") return;
          const target = localRows.find((r) => r.id === id);
          if (!target) return;
          if (!canArchive(target)) return;
          void archive(id);
        }}
      >
        <ArchiveDropZone active={Boolean(draggingId)} />

        <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
          <section className="min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-600">Tableau de bord</p>
                <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
                  <ClipboardList className="h-6 w-6 text-slate-700" aria-hidden="true" />
                  <span>Demandes</span>
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{pendingCount}</span> en attente
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setFilter(lastActiveFilter)}
                  className={`h-9 rounded-full px-4 text-sm font-semibold transition ${
                    isArchivedView ? "text-slate-600 hover:text-slate-900" : "bg-white text-slate-900 shadow-sm"
                  }`}
                >
                  Demandes
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("ARCHIVED")}
                  className={`h-9 rounded-full px-4 text-sm font-semibold transition ${
                    isArchivedView ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Archivées
                </button>
              </div>
            </div>

            <div className={`mt-5 grid gap-2 ${isArchivedView ? "md:grid-cols-1" : "md:grid-cols-[140px_1fr]"} md:items-center`}>
              {isArchivedView ? null : (
                <div>
                  <label className="sr-only" htmlFor="host-requests-filter">
                    Statut
                  </label>
                  <select
                    id="host-requests-filter"
                    value={filter}
                    onChange={(e) => {
                      const next = e.target.value as FilterKey;
                      setFilter(next);
                      if (next !== "ARCHIVED") {
                        setLastActiveFilter(next as Exclude<FilterKey, "ARCHIVED">);
                      }
                    }}
                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)]"
                  >
                    {(["ALL", "TO_ACCEPT", "CONFIRMED", "CANCELLED"] as const).map((k) => (
                      <option key={k} value={k}>
                        {filterLabel(k)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M8.5 3a5.5 5.5 0 104.384 8.824l2.146 2.146a.75.75 0 101.06-1.06l-2.146-2.146A5.5 5.5 0 008.5 3zm-4 5.5a4 4 0 117.999.001A4 4 0 014.5 8.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)]"
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-900">
              <p>{error}</p>
              {error.includes("401") ? null : (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50"
                >
                  Réessayer
                </button>
              )}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-[84px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100" />
                    <div className="flex-1">
                      <div className="h-4 w-2/3 rounded bg-slate-100" />
                      <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
                      <div className="mt-3 h-4 w-24 rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Aucune demande</p>
              <p className="mt-2 text-sm text-slate-600">Aucune demande ne correspond à ce filtre.</p>
            </div>
          ) : (
            <div className="mt-6">
              <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-auto px-1 pt-3 sm:pr-1 sm:pl-3">
                <div role="listbox" aria-label="Liste des demandes" className="space-y-2">
                  {filtered.map((r) => (
                    <DraggableRequestRow
                      key={r.id}
                      request={r}
                      selected={r.id === selectedId}
                      onSelect={() => {
                        setSelectedId(r.id);
                        setMobileOpen(true);
                      }}
                      onArchive={() => void archive(r.id)}
                      onDelete={() => setConfirmDeleteId(r.id)}
                      mode={filter === "ARCHIVED" ? "ARCHIVED" : "ACTIVE"}
                      draggingId={draggingId}
                      canArchive={canArchive(r)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          </section>

          <aside className="hidden min-w-0 lg:block">
            <div className="sticky top-0">
              <RequestDetailPanel
                request={selected}
                onStatusChange={(id: string, status: string) => {
                  setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
                }}
                onRefresh={onRetry}
              />
            </div>
          </aside>
        </div>

      <div className={`fixed inset-0 z-50 ${mobileOpen && selected ? "lg:hidden" : "hidden"}`}>
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => setMobileOpen(false)}
          className="absolute inset-0 bg-black/40"
        />
        <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-3xl bg-white p-4 shadow-[0_-18px_60px_-46px_rgba(2,6,23,0.35)]">
          <RequestDetailPanel
            request={selected}
            onStatusChange={(id: string, status: string) => {
              setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
            }}
            onRefresh={onRetry}
            onCloseMobile={() => {
              setMobileOpen(false);
            }}
          />
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.35)]">
          <div className="flex items-center gap-3">
            <span>{toast.message}</span>
            {toast.undoId ? (
              <button
                type="button"
                disabled={undoing}
                onClick={() => void unarchive(toast.undoId!)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`fixed inset-0 z-50 ${confirmDeleteId ? "" : "hidden"}`}>
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => {
            if (deleting) return;
            setConfirmDeleteId(null);
          }}
          className="absolute inset-0 bg-black/40"
        />
        <div className="absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.35)]">
          <p className="text-sm font-semibold text-slate-900">Supprimer définitivement ?</p>
          <p className="mt-2 text-sm text-slate-600">Cette action est définitive.</p>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirmDeleteId(null)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={deleting || !confirmDeleteId}
              onClick={() => {
                if (!confirmDeleteId) return;
                void hardDelete(confirmDeleteId);
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </div>
      </div>

      </DndContext>
    </div>
  );
}

function DraggableRequestRow({
  request,
  selected,
  onSelect,
  onArchive,
  onDelete,
  mode,
  draggingId,
  canArchive,
}: {
  request: HostRequest;
  selected: boolean;
  onSelect: () => void;
  onArchive: () => void;
  onDelete: () => void;
  mode: "ACTIVE" | "ARCHIVED";
  draggingId: string | null;
  canArchive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: request.id,
    disabled: mode !== "ACTIVE" || !canArchive,
  });

  const style = transform
    ? {
        transform: `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`,
      }
    : undefined;

  const dragging = isDragging || draggingId === request.id;

  return (
    <RequestListItem
      request={request}
      selected={selected}
      onSelect={onSelect}
      canArchive={mode === "ACTIVE" ? canArchive : false}
      onArchive={mode === "ACTIVE" ? onArchive : undefined}
      canDelete={mode === "ARCHIVED"}
      onDelete={mode === "ARCHIVED" ? onDelete : undefined}
      outerRef={setNodeRef}
      style={style}
      dragAttributes={attributes as any}
      dragListeners={listeners as any}
      dragging={dragging}
    />
  );
}

export type { HostRequest };
