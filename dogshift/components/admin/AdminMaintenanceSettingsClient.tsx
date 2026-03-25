"use client";

import { useCallback, useEffect, useState } from "react";

import { useMaintenance } from "@/components/platform/MaintenanceProvider";

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
    return <p className="text-sm text-slate-600">Chargement…</p>;
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
          Message personnalisé (optionnel)
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Laisser vide pour utiliser le message par défaut affiché sur le site et dans les réponses API 503.
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
    </div>
  );
}
