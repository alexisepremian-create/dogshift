/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AdminListSkeleton from "@/components/admin/AdminListSkeleton";

import AdminSitterActions from "@/components/admin/AdminSitterActions";

type VerificationStatus = "not_verified" | "pending" | "approved" | "rejected";

type ActiveSitterRow = {
  id: string;
  sitterId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  counts: { bookings: number; reviews: number };
  profile: {
    displayName: string | null;
    city: string | null;
    postalCode: string | null;
    address: string | null;
    published: boolean;
    verificationStatus: VerificationStatus | null;
    verificationNotes: string | null;
    profileCompletion: number | null;
    lifecycleStatus: string | null;
    contractVersion: string | null;
    activationCodeIssuedAt: string | null;
    contractAccessTokenIssuedAt: string | null;
    contractAccessTokenExpiresAt: string | null;
    amendmentUpToDate: boolean;
  } | null;
};

type Payload = {
  ok?: boolean;
  items?: ActiveSitterRow[];
  error?: string;
};

function formatFrCh(iso: string) {
  const dt = new Date(iso);
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(dt)
    .replaceAll(".", "-");
}

function verificationTone(status: VerificationStatus | null) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function verificationLabel(status: VerificationStatus | null) {
  if (status === "approved") return "Approuvé";
  if (status === "pending") return "En attente";
  if (status === "rejected") return "Refusé";
  return "Non vérifié";
}

export default function AdminActiveSittersClient() {
  const [items, setItems] = useState<ActiveSitterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [city, setCity] = useState("");
  const [verification, setVerification] = useState<"" | VerificationStatus>("");

  const [selectedId, setSelectedId] = useState<string>("");
  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (searchTerm.trim()) qs.set("q", searchTerm.trim());
      if (city.trim()) qs.set("city", city.trim());
      if (verification) qs.set("verification", verification);

      const res = await fetch(`/api/admin/sitters/active?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as Payload | null;
      if (!res.ok || !payload?.ok || !Array.isArray(payload.items)) {
        setError("Impossible de charger les dogsitters actifs.");
        setItems([]);
        return;
      }
      setItems(payload.items);
      if (payload.items.length && !selectedId) setSelectedId(payload.items[0].id);
    } catch {
      setError("Impossible de charger les dogsitters actifs.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle && !city.trim() && !verification) return items;
    return items.filter((it) => {
      if (verification && it.profile?.verificationStatus !== verification) return false;
      if (city.trim() && !(it.profile?.city || "").toLowerCase().includes(city.trim().toLowerCase())) return false;
      if (!needle) return true;
      const hay = `${it.name ?? ""} ${it.profile?.displayName ?? ""} ${it.email ?? ""} ${it.profile?.city ?? ""} ${it.sitterId ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, searchTerm, city, verification]);

  // Keep selection consistent with filters
  useEffect(() => {
    if (!filtered.length) return;
    if (selected && filtered.some((x) => x.id === selected.id)) return;
    setSelectedId(filtered[0].id);
  }, [filtered, selected]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.20)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Dogsitters actifs</h2>
          <p className="mt-2 text-sm text-slate-600">Liste des profils publiés, avec fiche détaillée et actions admin.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          Rafraîchir
        </button>
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}

      {loading ? (
        <AdminListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Aucun dogsitter actif</p>
          <p className="mt-2 text-sm text-slate-600">Aucun profil publié ne correspond aux filtres.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Liste</p>

            <div className="mt-3 grid gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher (nom, email, ville…)…"
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />

              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Filtrer par ville…"
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />

              <select
                value={verification}
                onChange={(e) => setVerification((e.target.value || "") as any)}
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              >
                <option value="">Vérification: toutes</option>
                <option value="approved">Approuvé</option>
                <option value="pending">En attente</option>
                <option value="rejected">Refusé</option>
                <option value="not_verified">Non vérifié</option>
              </select>
            </div>

            <div className="mt-4 grid gap-2">
              {filtered.map((s) => {
                const display = (s.profile?.displayName ?? "").trim() || (s.name ?? "").trim() || s.email || "—";
                const cityLabel = (s.profile?.city ?? "").trim() || "—";
                const ver = (s.profile?.verificationStatus ?? null) as VerificationStatus | null;
                const badgeClass = `inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${verificationTone(ver)}`;
                const active = s.id === selectedId;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={
                      "w-full rounded-2xl border px-4 py-3 text-left transition " +
                      (active ? "border-[var(--dogshift-blue)] bg-white" : "border-slate-200 bg-white hover:bg-slate-50")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{display}</p>
                      <span className={badgeClass}>{verificationLabel(ver)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{cityLabel}</p>
                    <p className="mt-1 text-xs text-slate-500">Inscrit: {formatFrCh(s.createdAt)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            {selected ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {(selected.profile?.displayName ?? "").trim() || (selected.name ?? "").trim() || selected.email || "—"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{selected.profile?.city || "—"}</p>
                    <div className="mt-3 grid gap-1 text-sm text-slate-700">
                      {selected.email ? <p><span className="font-semibold text-slate-900">Email :</span> {selected.email}</p> : null}
                      {selected.phone ? <p><span className="font-semibold text-slate-900">Téléphone :</span> {selected.phone}</p> : <p><span className="font-semibold text-slate-900">Téléphone :</span> —</p>}
                      <p><span className="font-semibold text-slate-900">Adresse :</span> {selected.profile?.address || "—"}</p>
                      <p><span className="font-semibold text-slate-900">Sitter ID :</span> {selected.sitterId || "—"}</p>
                    </div>
                    <Link
                      href={`/admin/sitters/${encodeURIComponent(selected.id)}`}
                      className="mt-2 inline-block text-xs font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]"
                    >
                      Ouvrir la fiche complète
                    </Link>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                      Publié
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${verificationTone((selected.profile?.verificationStatus ?? null) as any)}`}>
                      {verificationLabel((selected.profile?.verificationStatus ?? null) as any)}
                    </span>
                    <p className="text-xs text-slate-500">MAJ: {formatFrCh(selected.updatedAt)}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Profil</p>
                    <div className="mt-2 grid gap-1 text-xs text-slate-700">
                      <p><span className="font-semibold text-slate-900">Complétion :</span> {selected.profile?.profileCompletion ?? 0}%</p>
                      <p><span className="font-semibold text-slate-900">Publication :</span> {selected.profile?.published ? "Publié" : "Non publié"}</p>
                      <p><span className="font-semibold text-slate-900">Lifecycle :</span> {selected.profile?.lifecycleStatus ?? "—"}</p>
                      <p><span className="font-semibold text-slate-900">Vérification notes :</span> {selected.profile?.verificationNotes || "—"}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Activité</p>
                    <div className="mt-2 grid gap-1 text-xs text-slate-700">
                      <p><span className="font-semibold text-slate-900">Réservations :</span> {selected.counts.bookings}</p>
                      <p><span className="font-semibold text-slate-900">Avis :</span> {selected.counts.reviews}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Contrat / Avenant</p>
                    <div className="mt-2 grid gap-1 text-xs text-slate-700">
                      <p><span className="font-semibold text-slate-900">Version contrat :</span> {selected.profile?.contractVersion || "—"}</p>
                      <p><span className="font-semibold text-slate-900">Avenant à jour :</span> {selected.profile?.amendmentUpToDate ? "Oui" : "Non"}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Dates</p>
                    <div className="mt-2 grid gap-1 text-xs text-slate-700">
                      <p><span className="font-semibold text-slate-900">Inscription :</span> {formatFrCh(selected.createdAt)}</p>
                      <p><span className="font-semibold text-slate-900">Dernière mise à jour :</span> {formatFrCh(selected.updatedAt)}</p>
                    </div>
                  </div>
                </div>

                <AdminSitterActions
                  sitterUserId={selected.id}
                  initialPublished={Boolean(selected.profile?.published)}
                  initialVerificationStatus={(selected.profile?.verificationStatus ?? "not_verified") as any}
                  initialVerificationNotes={selected.profile?.verificationNotes ?? null}
                  initialLifecycleStatus={(selected.profile?.lifecycleStatus ?? "application_received") as any}
                  initialContractAccessTokenIssuedAt={selected.profile?.contractAccessTokenIssuedAt ?? null}
                  initialContractAccessTokenExpiresAt={selected.profile?.contractAccessTokenExpiresAt ?? null}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

