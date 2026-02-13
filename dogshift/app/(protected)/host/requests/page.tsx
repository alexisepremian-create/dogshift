"use client";

import { useEffect, useState } from "react";

import { RequestsSplitView, type HostRequest } from "@/components/host/requests/RequestsSplitView";
import SunCornerGlow from "@/components/SunCornerGlow";

export default function HostRequestsPage() {
  const [rows, setRows] = useState<HostRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/host/requests", { method: "GET" });
      const payload = (await res.json()) as { ok?: boolean; bookings?: HostRequest[]; error?: string };

      if (!res.ok || !payload.ok) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") {
          setError("Connexion requise (401). ");
          setRows([]);
          return;
        }
        if (res.status === 403 || payload.error === "FORBIDDEN") {
          setError("Accès refusé (403).");
          setRows([]);
          return;
        }
        if (res.status === 404 || payload.error === "NOT_FOUND") {
          setError("Introuvable (404).");
          setRows([]);
          return;
        }
        if (res.status >= 500) {
          setError("Erreur serveur (500). ");
          setRows([]);
          return;
        }
        setError("Impossible de charger tes demandes.");
        setRows([]);
        return;
      }

      setRows(Array.isArray(payload.bookings) ? payload.bookings : []);
    } catch {
      setError("Impossible de charger tes demandes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  return (
    <div className="relative grid min-h-screen gap-6 overflow-x-hidden" data-testid="host-requests-page">
      <div className="hidden sm:block">
        <SunCornerGlow variant="sitterRequests" />
      </div>

      <div className="relative z-10">
        <RequestsSplitView rows={rows} loading={loading} error={error} onRetry={() => void loadRequests()} />
      </div>
    </div>
  );
}
