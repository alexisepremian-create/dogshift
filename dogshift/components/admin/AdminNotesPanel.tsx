"use client";

import { useEffect, useState } from "react";

type AdminNoteTargetType = "USER" | "BOOKING" | "PILOT_SITTER_APPLICATION" | "SITTER_PROFILE";

type AdminNoteItem = {
  id: string;
  targetType: AdminNoteTargetType;
  targetId: string;
  body: string;
  authorClerkUserId: string | null;
  authorUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatDate(iso: string) {
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

export default function AdminNotesPanel({
  targetType,
  targetId,
  title = "Notes internes admin",
}: {
  targetType: AdminNoteTargetType;
  targetId: string;
  title?: string;
}) {
  const [notes, setNotes] = useState<AdminNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ targetType, targetId });
      const res = await fetch(`/api/admin/notes?${params.toString()}`, { method: "GET" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || !Array.isArray(payload?.notes)) {
        if (payload?.error === "ADMIN_NOTES_TABLE_NOT_READY") {
          setError("La table des notes admin n’est pas encore disponible sur cet environnement. Appliquez d’abord la migration additive.");
          setNotes([]);
          return;
        }
        setError("Impossible de charger les notes internes.");
        return;
      }
      setNotes(payload.notes as AdminNoteItem[]);
    } catch {
      setError("Impossible de charger les notes internes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [targetId, targetType]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const trimmed = body.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, body: trimmed }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || !payload?.note) {
        if (payload?.error === "ADMIN_NOTES_TABLE_NOT_READY") {
          setError("La migration AdminNote doit être appliquée sur cet environnement avant l’utilisation des notes internes.");
          return;
        }
        setError("Impossible d’ajouter la note interne.");
        return;
      }
      setBody("");
      setNotes((current) => [payload.note as AdminNoteItem, ...current]);
    } catch {
      setError("Impossible d’ajouter la note interne.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Visible uniquement dans l’admin. Aucune exposition côté public.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          Rafraîchir
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Ajouter une note interne…"
          disabled={submitting}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{body.length}/4000</p>
          <button
            type="submit"
            disabled={submitting || body.trim().length === 0}
            className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Enregistrement…" : "Ajouter la note"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}

      {loading ? (
        <p className="mt-5 text-sm text-slate-600">Chargement…</p>
      ) : notes.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Aucune note interne pour le moment.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{note.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{formatDate(note.createdAt)}</span>
                <span>•</span>
                <span>{note.authorUserId || note.authorClerkUserId || "admin"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
