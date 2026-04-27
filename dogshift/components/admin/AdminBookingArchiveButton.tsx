"use client";

import { useState } from "react";

export default function AdminBookingArchiveButton({ bookingId }: { bookingId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    if (status === "loading" || status === "done") return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/archive`, { method: "POST" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        setError(payload?.error ?? "ERREUR");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError("ERREUR RÉSEAU");
      setStatus("error");
    }
  }

  if (status === "done") {
    return <span className="text-xs font-semibold text-slate-400">Archivée</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={status === "loading"}
        onClick={() => void archive()}
        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "…" : "Archiver"}
      </button>
      {error ? <span className="text-[10px] font-medium text-rose-600">{error}</span> : null}
    </div>
  );
}
