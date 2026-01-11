"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { RequestsSplitView, type HostRequest } from "@/components/host/requests/RequestsSplitView";
import SunCornerGlow from "@/components/SunCornerGlow";

export default function HostRequestsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

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
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="host-requests-page">
      <SunCornerGlow variant="sitterRequests" />

      <div className="relative z-10">
        <RequestsSplitView rows={rows} loading={loading} error={error} onRetry={() => void loadRequests()} />
      </div>
    </div>
  );
}
