"use client";

import { useEffect, useMemo, useState } from "react";

import { MOCK_SITTERS } from "@/lib/mockSitters";
import {
  getDefaultHostProfile,
  loadHostProfileFromStorage,
  saveHostProfileToStorage,
  type HostProfileV1,
} from "@/lib/hostProfile";

function StatusPill({ status }: { status: HostProfileV1["verificationStatus"] }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
        Vérifié
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm">
        En cours
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      Non vérifié
    </span>
  );
}

export default function AdminHostClient() {
  const sitterOptions = useMemo(() => MOCK_SITTERS.map((s) => ({ id: s.id, name: s.name })), []);
  const [sitterId, setSitterId] = useState<string>(sitterOptions[0]?.id ?? "s-1");
  const [profile, setProfile] = useState<HostProfileV1>(() => getDefaultHostProfile(sitterId));

  useEffect(() => {
    const stored = loadHostProfileFromStorage(sitterId);
    setProfile(stored ?? getDefaultHostProfile(sitterId));
  }, [sitterId]);

  function setStatus(nextStatus: HostProfileV1["verificationStatus"]) {
    const next: HostProfileV1 = {
      ...(loadHostProfileFromStorage(sitterId) ?? getDefaultHostProfile(sitterId)),
      sitterId,
      verificationStatus: nextStatus,
    };
    saveHostProfileToStorage(next);
    setProfile(next);
  }

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.25)] sm:p-8">
      <h2 className="text-base font-semibold text-slate-900">Vérification Host (mock)</h2>
      <p className="mt-2 text-sm text-slate-600">Source: localStorage • Clé: ds_host_profile_[sitterId]</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="admin_host_sitter" className="block text-sm font-medium text-slate-700">
            Sitter
          </label>
          <select
            id="admin_host_sitter"
            value={sitterId}
            onChange={(e) => setSitterId(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
          >
            {sitterOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-700">Statut:</p>
          <StatusPill status={profile.verificationStatus} />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setStatus("verified")}
          className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          Valider le profil
        </button>
        <button
          type="button"
          onClick={() => setStatus("pending")}
          className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
        >
          Mettre en cours
        </button>
        <button
          type="button"
          onClick={() => setStatus("unverified")}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          Reset (non vérifié)
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-500">*Admin mock — aucune API, aucune donnée serveur.</p>
    </section>
  );
}
