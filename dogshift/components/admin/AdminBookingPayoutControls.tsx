"use client";

import { useEffect, useState } from "react";

type PayoutMethod = "STRIPE" | "MANUAL";
type PayoutStatus = "PENDING" | "PAID";

type BookingPayoutPayload = {
  id: string;
  status: string;
  payoutMethod: PayoutMethod;
  payoutStatus: PayoutStatus;
  paidAt: string | null;
};

export default function AdminBookingPayoutControls({ bookingId }: { bookingId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<string>("—");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("STRIPE");
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus>("PENDING");

  const toast = error ? { kind: "error" as const, text: error } : success ? { kind: "success" as const, text: success } : null;

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/payout`, { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; booking?: BookingPayoutPayload; message?: string } | null;
      if (!res.ok || !payload?.ok || !payload.booking) {
        setError(payload?.message ?? "Impossible de charger les états de paiement.");
        return;
      }
      setBookingStatus(payload.booking.status || "—");
      setPayoutMethod(payload.booking.payoutMethod);
      setPayoutStatus(payload.booking.payoutStatus);
    } catch {
      setError("Impossible de charger les états de paiement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // bookingId is stable for this page instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/payout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutMethod, payoutStatus }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || !payload?.ok) {
        setError(payload?.message ?? "Impossible d'enregistrer les états de paiement.");
        return;
      }
      setSuccess(payload?.message ?? "États de paiement mis à jour.");
      await load();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  function applyManualPaidPreset() {
    setPayoutMethod("MANUAL");
    setPayoutStatus("PAID");
    setSuccess(null);
    setError(null);
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">Paiement & payout</h3>
      <p className="mt-2 text-sm text-slate-600">
        Réservation: <span className="font-semibold text-slate-900">{bookingStatus}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${payoutMethod === "MANUAL" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>
          {payoutMethod === "MANUAL" ? "Payé manuellement" : "Payé via Stripe"}
        </span>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${payoutStatus === "PAID" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {payoutStatus === "PAID" ? "Payout payé" : "Payout en attente"}
        </span>
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-600">Chargement…</p> : null}

      {!loading ? (
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Méthode de payout</span>
            <select
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value as PayoutMethod)}
              className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
            >
              <option value="STRIPE">STRIPE</option>
              <option value="MANUAL">MANUAL</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Statut payout</span>
            <select
              value={payoutStatus}
              onChange={(e) => setPayoutStatus(e.target.value as PayoutStatus)}
              className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
            >
              <option value="PENDING">PENDING</option>
              <option value="PAID">PAID</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyManualPaidPreset}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Preset TWINT / manuel payé
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || saving}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              Rafraîchir
            </button>
          </div>

          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
          {success ? <p className="text-sm font-medium text-emerald-700">{success}</p> : null}
        </div>
      ) : null}
      {toast ? (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${toast.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          {toast.text}
        </div>
      ) : null}
    </section>
  );
}
