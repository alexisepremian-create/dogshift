"use client";

import { useEffect, useState } from "react";

import { RequestsSplitView, type HostRequest } from "@/components/host/requests/RequestsSplitView";

// In-session cache so re-opening "Demandes" (tile sheet or bottom nav) paints
// instantly, then revalidates silently. Cleared on a full reload. Mirrors the
// owner-side panels.
let cachedHostRequests: HostRequest[] | null = null;

export default function HostRequestsPage() {
  const [rows, setRows] = useState<HostRequest[]>(() => cachedHostRequests ?? []);
  const [loading, setLoading] = useState(() => cachedHostRequests === null);
  const [error, setError] = useState<string | null>(null);

  async function loadRequests(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/host/requests", { method: "GET" });
      const payload = (await res.json()) as { ok?: boolean; bookings?: HostRequest[]; error?: string };

      if (!res.ok || !payload.ok) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") {
          setError("Connexion requise (401). ");
          if (!silent) setRows([]);
          return;
        }
        if (res.status === 403 || payload.error === "FORBIDDEN") {
          setError("Accès refusé (403).");
          if (!silent) setRows([]);
          return;
        }
        if (res.status === 404 || payload.error === "NOT_FOUND") {
          setError("Introuvable (404).");
          if (!silent) setRows([]);
          return;
        }
        if (res.status >= 500) {
          setError("Erreur serveur (500). ");
          if (!silent) setRows([]);
          return;
        }
        setError("Impossible de charger tes réservations.");
        if (!silent) setRows([]);
        return;
      }

      const list = Array.isArray(payload.bookings) ? payload.bookings : [];
      cachedHostRequests = list;
      setRows(list);
    } catch {
      setError("Impossible de charger tes réservations.");
      if (!silent) setRows([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    // Cached already rendered → refresh silently (no spinner).
    void loadRequests(cachedHostRequests !== null);
  }, []);

  return (
    <div className="relative grid min-h-screen gap-6 overflow-x-hidden" data-testid="host-requests-page">
      <div className="relative z-10">
        <RequestsSplitView rows={rows} loading={loading} error={error} onRetry={() => void loadRequests()} />
      </div>
    </div>
  );
}
