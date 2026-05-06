"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminSimpleListSkeleton } from "@/components/admin/AdminListSkeleton";

import { useMaintenance } from "@/components/platform/MaintenanceProvider";

function GeocodeSittersButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{ total: number; geocoded: number; failed: number; errors: string[] } | null>(null);

  async function run() {
    setStatus("running");
    setResult(null);
    try {
      const res = await fetch("/api/admin/geocode-sitters", { method: "POST" });
      const data = await res.json() as { ok?: boolean; total?: number; geocoded?: number; failed?: number; errors?: string[] };
      if (!res.ok || !data.ok) {
        setStatus("error");
        return;
      }
      setResult({ total: data.total ?? 0, geocoded: data.geocoded ?? 0, failed: data.failed ?? 0, errors: data.errors ?? [] });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Géocodage des profils publiés</p>
        <p className="mt-1 text-sm text-slate-600">
          Attribue les coordonnées GPS aux profils publiés qui n&apos;apparaissent pas encore sur la carte (lat/lng manquants).
        </p>
        {status === "done" && result ? (
          <p className="mt-2 text-sm text-emerald-700">
            ✓ {result.geocoded} géocodé{result.geocoded !== 1 ? "s" : ""} sur {result.total} profil{result.total !== 1 ? "s" : ""} concerné{result.total !== 1 ? "s" : ""}.
            {result.failed > 0 ? ` ${result.failed} échec(s).` : ""}
          </p>
        ) : status === "error" ? (
          <p className="mt-2 text-sm text-red-700">Une erreur est survenue. Réessayez.</p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={status === "running"}
        onClick={() => void run()}
        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "running" ? "Géocodage en cours…" : "Lancer le géocodage"}
      </button>
    </div>
  );
}

export default function AdminMaintenanceSettingsClient() {
  const { refresh: refreshPublicMaintenance } = useMaintenance();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/platform-settings", { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        maintenanceMode?: boolean;
        maintenanceMessage?: string | null;
        updatedAt?: string | null;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error === "FORBIDDEN" ? "Accès refusé." : "Impossible de charger les paramètres.");
        return;
      }
      setMaintenanceMode(Boolean(data.maintenanceMode));
      setMessageDraft(typeof data.maintenanceMessage === "string" ? data.maintenanceMessage : "");
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : null);
    } catch {
      setError("Impossible de charger les paramètres.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePatch(patch: { maintenanceMode?: boolean; maintenanceMessage?: string | null }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        maintenanceMode?: boolean;
        maintenanceMessage?: string | null;
        updatedAt?: string | null;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error === "FORBIDDEN" ? "Accès refusé." : "Enregistrement impossible.");
        return;
      }
      setMaintenanceMode(Boolean(data.maintenanceMode));
      setMessageDraft(typeof data.maintenanceMessage === "string" ? data.maintenanceMessage : "");
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : null);
      await refreshPublicMaintenance();
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AdminSimpleListSkeleton rows={3} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Mode maintenance</p>
          <p className="mt-1 text-sm text-slate-600">
            État actuel :{" "}
            <span className={maintenanceMode ? "font-semibold text-amber-800" : "font-semibold text-emerald-800"}>
              {maintenanceMode ? "activé (réservations / paiements bloqués côté API)" : "désactivé"}
            </span>
          </p>
          {updatedAt ? (
            <p className="mt-1 text-xs text-slate-500">Dernière mise à jour : {new Date(updatedAt).toLocaleString("fr-CH")}</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void savePatch({ maintenanceMode: !maintenanceMode })}
          className={`inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            maintenanceMode ? "bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600" : "bg-amber-600 hover:bg-amber-700 focus-visible:outline-amber-600"
          }`}
        >
          {saving ? "…" : maintenanceMode ? "Désactiver la maintenance" : "Activer la maintenance"}
        </button>
      </div>

      <div>
        <label htmlFor="maintenanceMessage" className="text-sm font-semibold text-slate-900">
          Précision affichée aux utilisateurs (optionnel)
        </label>
        <p className="mt-1 text-xs text-slate-500">
          S’affiche sous le bandeau (horaires, détail). Les pages ajoutent automatiquement la précision pertinente (réservations,
          contributions…). Utilisé aussi dans les réponses API 503 si renseigné.
        </p>
        <textarea
          id="maintenanceMessage"
          value={messageDraft}
          onChange={(e) => setMessageDraft(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-[var(--dogshift-blue)]"
          placeholder="Ex. Maintenance planifiée jusqu’à 18h — merci de votre patience."
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void savePatch({
                maintenanceMessage: messageDraft.trim() ? messageDraft.trim() : null,
              })
            }
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Enregistrer le message
          </button>
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      <p className="text-xs leading-relaxed text-slate-500">
        Les webhooks Stripe restent actifs pour traiter les paiements déjà initiés. Seules les créations de réservation, les Payment
        Intents et les sessions Checkout « contribution » sont refusées tant que la maintenance est active.
      </p>

      <div className="border-t border-slate-100 pt-5">
        <GeocodeSittersButton />
      </div>
    </div>
  );
}
