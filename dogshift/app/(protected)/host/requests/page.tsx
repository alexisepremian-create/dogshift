"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { RequestsSplitView, type HostRequest } from "@/components/host/requests/RequestsSplitView";
import SunCornerGlow from "@/components/SunCornerGlow";
import { useHostUser } from "@/components/HostUserProvider";

export default function HostRequestsPage() {
  const { sitterId } = useHostUser();
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
    if (!sitterId) return;
    void loadRequests();
  }, [sitterId]);

  if (!sitterId) {
    return (
      <div className="relative grid gap-6 overflow-hidden" data-testid="host-requests-page">
        <SunCornerGlow variant="sitterRequests" />
        <div className="relative z-10 rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Accès réservé aux dogsitters</p>
          <p className="mt-2 text-sm text-slate-600">Crée ton profil dogsitter pour accéder aux demandes & réservations.</p>
          <div className="mt-4">
            <Link href="/become-sitter" className="text-sm font-semibold text-[var(--dogshift-blue)]">
              Devenir dogsitter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="host-requests-page">
      <SunCornerGlow variant="sitterRequests" />

      <div className="relative z-10">
        <RequestsSplitView rows={rows} loading={loading} error={error} onRetry={() => void loadRequests()} />
      </div>
    </div>
  );
}
