"use client";

import { useState } from "react";

/**
 * "Voir comme" button used in the /admin/impersonate table. Posts to
 * /api/admin/impersonate/start, then full-page navigates to the redirect URL
 * the endpoint returns. Full reload (not Next router push) is important: the
 * impersonation cookie must be in place for every server component render,
 * and only a fresh page request reliably re-runs them all.
 */
export default function ImpersonateRowButton({
  userId,
  targetEmail,
}: {
  userId: string;
  targetEmail: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/impersonate/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; redirectTo?: string; error?: string }
        | null;
      if (!res.ok || !json?.ok || !json.redirectTo) {
        setError(json?.error ?? `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      window.location.href = json.redirectTo;
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={submitting}
        aria-label={`Impersonifier ${targetEmail}`}
        style={{ touchAction: "manipulation" }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70"
      >
        {submitting ? "Démarrage…" : "👁️ Voir comme"}
      </button>
      {error ? <span className="text-[10px] text-rose-600">{error}</span> : null}
    </div>
  );
}
