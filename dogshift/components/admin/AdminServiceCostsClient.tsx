"use client";

import { useEffect, useMemo, useState } from "react";

type ServiceType = "hosting" | "db" | "payment" | "email" | "auth" | "other";
type CostType = "fixed" | "variable";

type ServiceCost = {
  id: string;
  name: string;
  type: ServiceType;
  costType: CostType;
  monthlyCost: number;
  notes: string | null;
  active: boolean;
  estimatedCostPerBooking: number | null;
  createdAt: string;
  updatedAt: string;
};

type Draft = {
  name: string;
  type: ServiceType;
  costType: CostType;
  monthlyCost: string;
  notes: string;
  active: boolean;
  estimatedCostPerBooking: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  type: "hosting",
  costType: "fixed",
  monthlyCost: "",
  notes: "",
  active: true,
  estimatedCostPerBooking: "",
};

function chf(value: number) {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function typeLabel(v: ServiceType) {
  if (v === "hosting") return "Hosting";
  if (v === "db") return "DB";
  if (v === "payment") return "Payment";
  if (v === "email") return "Email";
  if (v === "auth") return "Auth";
  return "Other";
}

export default function AdminServiceCostsClient() {
  const [items, setItems] = useState<ServiceCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/service-costs", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; services?: ServiceCost[]; message?: string } | null;
      if (!res.ok || !payload?.ok) {
        setError(payload?.message ?? "Impossible de charger les coûts.");
        setLoading(false);
        return;
      }
      setItems(Array.isArray(payload.services) ? payload.services : []);
    } catch {
      setError("Impossible de charger les coûts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalMonthly = useMemo(() => items.filter((i) => i.active).reduce((sum, i) => sum + Number(i.monthlyCost || 0), 0), [items]);
  const totalPerBooking = useMemo(
    () => items.filter((i) => i.active).reduce((sum, i) => sum + Number(i.estimatedCostPerBooking || 0), 0),
    [items],
  );

  function onEdit(item: ServiceCost) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      type: item.type,
      costType: item.costType,
      monthlyCost: String(item.monthlyCost),
      notes: item.notes ?? "",
      active: item.active,
      estimatedCostPerBooking: item.estimatedCostPerBooking == null ? "" : String(item.estimatedCostPerBooking),
    });
    setError(null);
    setSuccess(null);
  }

  function resetDraft() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  async function submitDraft() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const monthlyCost = Number(draft.monthlyCost);
    const estimatedCostPerBooking = draft.estimatedCostPerBooking.trim() === "" ? null : Number(draft.estimatedCostPerBooking);
    if (!draft.name.trim() || !Number.isFinite(monthlyCost) || monthlyCost < 0) {
      setError("Merci de renseigner un nom et un coût mensuel valide.");
      setSaving(false);
      return;
    }
    if (estimatedCostPerBooking != null && (!Number.isFinite(estimatedCostPerBooking) || estimatedCostPerBooking < 0)) {
      setError("Le coût estimé par réservation doit être >= 0.");
      setSaving(false);
      return;
    }

    const payload = {
      name: draft.name.trim(),
      type: draft.type,
      costType: draft.costType,
      monthlyCost,
      notes: draft.notes.trim() || null,
      active: draft.active,
      estimatedCostPerBooking,
    };

    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(isEdit ? `/api/admin/service-costs/${editingId}` : "/api/admin/service-costs", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? `Impossible de ${isEdit ? "modifier" : "créer"} le service.`);
        return;
      }
      setSuccess(isEdit ? "Service modifié." : "Service ajouté.");
      resetDraft();
      await load();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (rowLoadingId) return;
    setRowLoadingId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/service-costs/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "Impossible de supprimer le service.");
        return;
      }
      if (editingId === id) resetDraft();
      setSuccess("Service supprimé.");
      await load();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setRowLoadingId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Coûts & abonnements</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Suivi financier mensuel</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Coût total mensuel estimé</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{chf(totalMonthly)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Coût estimé par réservation (total)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{chf(totalPerBooking)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">{editingId ? "Modifier un service" : "Ajouter un service"}</h3>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Nom</span>
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="h-11 rounded-2xl border border-slate-300 px-4 text-sm" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Type</span>
            <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as ServiceType }))} className="h-11 rounded-2xl border border-slate-300 px-4 text-sm">
              <option value="hosting">Hosting</option>
              <option value="db">DB</option>
              <option value="payment">Payment</option>
              <option value="email">Email</option>
              <option value="auth">Auth</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Type de coût</span>
            <select value={draft.costType} onChange={(e) => setDraft((d) => ({ ...d, costType: e.target.value as CostType }))} className="h-11 rounded-2xl border border-slate-300 px-4 text-sm">
              <option value="fixed">Fixe</option>
              <option value="variable">Variable</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Coût mensuel (CHF)</span>
            <input value={draft.monthlyCost} onChange={(e) => setDraft((d) => ({ ...d, monthlyCost: e.target.value }))} className="h-11 rounded-2xl border border-slate-300 px-4 text-sm" inputMode="decimal" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Coût estimé par réservation (CHF)</span>
            <input value={draft.estimatedCostPerBooking} onChange={(e) => setDraft((d) => ({ ...d, estimatedCostPerBooking: e.target.value }))} className="h-11 rounded-2xl border border-slate-300 px-4 text-sm" inputMode="decimal" />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
            <span>Service actif</span>
          </label>
        </div>
        <label className="mt-4 grid gap-2">
          <span className="text-sm font-medium text-slate-700">Notes</span>
          <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} rows={4} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
        </label>

        {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
        {success ? <p className="mt-4 text-sm font-medium text-emerald-700">{success}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => void submitDraft()} disabled={saving} className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:opacity-60">
            {saving ? "Enregistrement…" : editingId ? "Enregistrer les changements" : "Ajouter un service"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetDraft} className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
              Annuler
            </button>
          ) : null}
          <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
            Rafraîchir
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Services</h3>
        {loading ? <p className="mt-4 text-sm text-slate-600">Chargement…</p> : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nom</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Coût</th>
                  <th className="px-4 py-3 font-semibold">Par réservation</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      {item.notes ? <p className="mt-1 text-xs text-slate-500">{item.notes}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{typeLabel(item.type)} · {item.costType === "fixed" ? "Fixe" : "Variable"}</td>
                    <td className="px-4 py-3 text-slate-900">{chf(Number(item.monthlyCost || 0))}</td>
                    <td className="px-4 py-3 text-slate-900">{item.estimatedCostPerBooking == null ? "—" : chf(Number(item.estimatedCostPerBooking || 0))}</td>
                    <td className="px-4 py-3">
                      {item.active ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">Actif</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Inactif</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onEdit(item)} className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
                          Éditer
                        </button>
                        <button type="button" onClick={() => void deleteItem(item.id)} disabled={rowLoadingId != null} className="inline-flex items-center rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 shadow-sm transition hover:bg-rose-100 disabled:opacity-60">
                          {rowLoadingId === item.id ? "Suppression…" : "Supprimer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

