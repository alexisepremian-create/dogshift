"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CalendarDays } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";

type BookingListItem = {
  id: string;
  createdAt: string;
  archivedAt?: string | null;
  service: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  amount: number;
  currency: string;
  platformFeeAmount: number;
  sitter: { sitterId: string; name: string; avatarUrl: string | null; city?: string | null; postalCode?: string | null };
};

type BookingDetail = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sitterId: string;
  service: string | null;
  startDate: string | null;
  endDate: string | null;
  message: string | null;
  status: string;
  canceledAt: string | null;
  amount: number;
  currency: string;
  platformFeeAmount: number;
  stripePaymentIntentId: string | null;
  sitter: { sitterId: string; name: string; avatarUrl: string | null; city?: string | null; postalCode?: string | null };
};

function sitterLocation(sitter: { city?: string | null; postalCode?: string | null } | null | undefined) {
  const city = typeof sitter?.city === "string" && sitter.city.trim() ? sitter.city.trim() : "";
  const pc = typeof sitter?.postalCode === "string" && sitter.postalCode.trim() ? sitter.postalCode.trim() : "";
  if (pc && city) return `${pc} ${city}`;
  return city || pc || "—";
}

function avatarIsSafe(src: string) {
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && url.hostname === "lh3.googleusercontent.com";
  } catch {
    return false;
  }
}

function initialForName(name: string) {
  const cleaned = (name ?? "").trim();
  if (!cleaned) return "?";
  return cleaned.slice(0, 1).toUpperCase();
}

function formatChfCents(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(value / 100);
}

function formatDateOnly(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", year: "numeric" }).format(dt);
}

function formatTimeOnly(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("fr-CH", { hour: "2-digit", minute: "2-digit" }).format(dt);
}

function isMidnightUtc(iso: string | null) {
  if (!iso) return true;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return true;
  return dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0;
}

function statusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return { label: "En attente", tone: "amber" as const };
    case "PENDING_PAYMENT":
      return { label: "En attente", tone: "amber" as const };
    case "PENDING_ACCEPTANCE":
      return { label: "En attente", tone: "amber" as const };
    case "PAID":
      return { label: "En attente", tone: "amber" as const };
    case "CONFIRMED":
      return { label: "Confirmée", tone: "emerald" as const };
    case "PAYMENT_FAILED":
      return { label: "Paiement refusé", tone: "rose" as const };
    case "CANCELLED":
      return { label: "Annulée", tone: "slate" as const };
    case "REFUNDED":
      return { label: "Remboursée", tone: "slate" as const };
    case "REFUND_FAILED":
      return { label: "Remboursement échoué", tone: "rose" as const };
    case "DRAFT":
      return { label: "Brouillon", tone: "slate" as const };
    default:
      return { label: status || "—", tone: "slate" as const };
  }
}

function StatusPill({ status }: { status: string }) {
  const s = statusLabel(status);
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold shadow-sm";
  if (s.tone === "emerald") return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}>{s.label}</span>;
  if (s.tone === "amber") return <span className={`${base} border-amber-200 bg-amber-50 text-amber-800`}>{s.label}</span>;
  if (s.tone === "rose") return <span className={`${base} border-rose-200 bg-rose-50 text-rose-800`}>{s.label}</span>;
  return <span className={`${base} border-slate-200 bg-slate-50 text-slate-700`}>{s.label}</span>;
}

type TabKey = "ALL" | "PENDING" | "CONFIRMED" | "CANCELLED" | "ARCHIVED";

function tabLabel(key: TabKey) {
  if (key === "ALL") return "Toutes";
  if (key === "PENDING") return "En attente";
  if (key === "CONFIRMED") return "Confirmées";
  if (key === "CANCELLED") return "Annulées / refusées";
  if (key === "ARCHIVED") return "Archivées";
  return "Toutes";
}

function tabFromQuery(value: string) {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "pending") return "PENDING" as const;
  if (v === "pending_payment") return "PENDING" as const;
  if (v === "to_accept") return "PENDING" as const;
  if (v === "pending_acceptance") return "PENDING" as const;
  if (v === "confirmed") return "CONFIRMED" as const;
  if (v === "cancelled") return "CANCELLED" as const;
  if (v === "canceled") return "CANCELLED" as const;
  if (v === "failed") return "CANCELLED" as const;
  if (v === "archived") return "ARCHIVED" as const;
  return "ALL" as const;
}

function matchesTab(b: BookingListItem, tab: TabKey) {
  const status = String(b.status ?? "");
  const archived = Boolean(b.archivedAt);
  if (tab === "ARCHIVED") return archived;
  if (archived) return false;
  if (tab === "ALL") return true;
  if (tab === "PENDING") {
    return status === "PENDING_PAYMENT" || status === "DRAFT" || status === "PENDING_ACCEPTANCE" || status === "PAID";
  }
  if (tab === "CONFIRMED") return status === "CONFIRMED";
  if (tab === "CANCELLED") return status === "CANCELLED" || status === "PAYMENT_FAILED" || status === "REFUNDED" || status === "REFUND_FAILED";
  return true;
}

function emptyCopy(tab: TabKey) {
  if (tab === "PENDING") return "Aucune réservation en attente de paiement.";
  if (tab === "CONFIRMED") return "Aucune réservation confirmée pour le moment.";
  if (tab === "CANCELLED") return "Aucune réservation annulée / refusée.";
  if (tab === "ARCHIVED") return "Aucune réservation archivée.";
  return "Aucune réservation pour le moment.";
}

function pendingBlockingReason(status: string) {
  const s = String(status ?? "");
  if (s === "PENDING_ACCEPTANCE" || s === "PAID") return "En attente d’acceptation";
  if (s === "PENDING_PAYMENT" || s === "DRAFT") return "Paiement requis";
  return null;
}

function uiStatusForBadge(status: string) {
  const s = String(status ?? "");
  if (s === "PENDING_PAYMENT" || s === "DRAFT" || s === "PENDING_ACCEPTANCE" || s === "PAID") return "PENDING";
  return s;
}

function matchesPendingSubfilter(status: string, sub: "payment" | "acceptance" | "") {
  if (!sub) return true;
  const s = String(status ?? "");
  if (sub === "payment") return s === "PENDING_PAYMENT" || s === "DRAFT";
  if (sub === "acceptance") return s === "PENDING_ACCEPTANCE" || s === "PAID";
  return true;
}

export default function AccountBookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();

  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadBookings() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/bookings", { method: "GET" });
      const payload = (await res.json()) as { ok?: boolean; bookings?: BookingListItem[]; error?: string };

      if (!res.ok || !payload.ok) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") {
          setError("Connexion requise (401). ");
          setBookings([]);
          return;
        }
        if (res.status === 403 || payload.error === "FORBIDDEN") {
          setError("Accès refusé (403).");
          setBookings([]);
          return;
        }
        if (res.status === 404 || payload.error === "NOT_FOUND") {
          setError("Introuvable (404).");
          setBookings([]);
          return;
        }
        if (res.status >= 500) {
          setError("Erreur serveur (500). ");
          setBookings([]);
          return;
        }
        setError("Impossible de charger tes réservations.");
        setBookings([]);
        return;
      }

      setBookings(Array.isArray(payload.bookings) ? payload.bookings : []);
    } catch {
      setError("Impossible de charger tes réservations.");
      setBookings([]);
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
    void loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  const activeTab = useMemo<TabKey>(() => {
    const tabQ = searchParams?.get("tab");
    if (tabQ) return tabFromQuery(tabQ);
    const statusQ = searchParams?.get("status");
    if (statusQ) return tabFromQuery(statusQ);
    return "ALL";
  }, [searchParams]);

  const initialSelectedFromQuery = useMemo(() => {
    const q = searchParams?.get("id");
    return typeof q === "string" && q.trim() ? q.trim() : "";
  }, [searchParams]);

  const pendingSubfilter = useMemo(() => {
    const raw = (searchParams?.get("pending") ?? "").trim().toLowerCase();
    if (raw === "payment") return "payment" as const;
    if (raw === "acceptance") return "acceptance" as const;
    return "" as const;
  }, [searchParams]);

  const counts = useMemo(() => {
    const base = {
      ALL: 0,
      PENDING: 0,
      CONFIRMED: 0,
      CANCELLED: 0,
      ARCHIVED: 0,
    } as Record<TabKey, number>;

    for (const b of bookings) {
      if (matchesTab(b, "ALL")) base.ALL += 1;
      if (matchesTab(b, "PENDING")) base.PENDING += 1;
      if (matchesTab(b, "CONFIRMED")) base.CONFIRMED += 1;
      if (matchesTab(b, "CANCELLED")) base.CANCELLED += 1;
      if (matchesTab(b, "ARCHIVED")) base.ARCHIVED += 1;
    }
    return base;
  }, [bookings]);

  const rows = useMemo(() => {
    const filtered = bookings
      .filter((b) => matchesTab(b, activeTab))
      .filter((b) => (activeTab === "PENDING" ? matchesPendingSubfilter(b.status, pendingSubfilter) : true));
    return filtered.slice().sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
  }, [activeTab, bookings, pendingSubfilter]);

  useEffect(() => {
    if (loading) return;
    if (rows.length === 0) {
      setSelectedId(null);
      setMobileDetailOpen(false);
      setDetail(null);
      return;
    }

    const desired = initialSelectedFromQuery;
    if (desired && rows.some((r) => r.id === desired)) {
      setSelectedId(desired);
      return;
    }

    if (!selectedId || !rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0]!.id);
    }
  }, [initialSelectedFromQuery, loading, rows, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    const currentTab = activeTab.toLowerCase();
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("status");
    params.set("tab", currentTab);
    params.set("id", selectedId);
    router.replace(`/account/bookings?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedId]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return rows.find((r) => r.id === selectedId) ?? null;
  }, [rows, selectedId]);

  useEffect(() => {
    let canceled = false;

    async function loadDetail(id: string) {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/account/bookings/${encodeURIComponent(id)}`, { method: "GET" });
        const payload = (await res.json()) as { ok?: boolean; booking?: BookingDetail };
        if (canceled) return;
        if (!res.ok || !payload.ok || !payload.booking) {
          setDetail(null);
          return;
        }
        setDetail(payload.booking);
      } catch {
        if (canceled) return;
        setDetail(null);
      } finally {
        if (!canceled) setDetailLoading(false);
      }
    }

    if (!selectedId) return () => {};
    void loadDetail(selectedId);
    return () => {
      canceled = true;
    };
  }, [selectedId]);

  if (!isLoaded || !isSignedIn) return null;
  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-900 sm:p-8">
        <p>{error}</p>
        {error.includes("401") ? (
          <Link
            href="/login"
            className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
          >
            Se connecter
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="account-bookings-page">
      <SunCornerGlow variant="ownerBookings" />

      <div className="relative z-10">
        <div>
          <p className="text-sm font-semibold text-slate-600">Mon compte</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            <CalendarDays className="h-6 w-6 text-slate-700" aria-hidden="true" />
            <span>Réservations</span>
          </h1>
          <div className="mt-3 flex min-h-[32px] items-center">
            <p className="text-sm text-slate-600">Retrouve ici tes demandes et leur statut.</p>
          </div>
        </div>

      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="overflow-x-auto">
          <div className="inline-flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {(["ALL", "PENDING", "CONFIRMED", "CANCELLED", "ARCHIVED"] as TabKey[]).map((key) => {
              const active = key === activeTab;
              const count = counts[key] ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams?.toString() ?? "");
                    params.delete("status");
                    params.set("tab", key.toLowerCase());
                    router.replace(`/account/bookings?${params.toString()}`);
                  }}
                  className={
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition" +
                    (active
                      ? " border-slate-200 bg-slate-50 text-slate-900"
                      : " border-transparent bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900")
                  }
                >
                  {tabLabel(key)}
                  {count > 0 ? (
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-900 sm:p-8">
          <p>{error}</p>
          {error.includes("401") ? (
            <Link
              href="/login"
              className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
            >
              Se connecter
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void loadBookings()}
              className="mt-4 inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50"
            >
              Réessayer
            </button>
          )}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold text-slate-900">Chargement…</p>
          <p className="mt-2 text-sm text-slate-600">Nous récupérons tes réservations.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
          <p className="text-sm font-semibold text-slate-900">{emptyCopy(activeTab)}</p>
          <p className="mt-2 text-sm text-slate-600">
            {activeTab === "ALL"
              ? "Quand tu réserves un dogsitter, la demande apparaîtra ici automatiquement."
              : "Change d’onglet pour voir d’autres réservations ou démarre une nouvelle demande."}
          </p>
          {activeTab === "ALL" ? (
            <div className="mt-5">
              <Link
                href="/search"
                className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
              >
                Trouver un sitter
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[38%_1fr]">
          <div className={mobileDetailOpen ? "hidden lg:block" : "block"}>
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-sm font-semibold text-slate-900">Liste</p>
                <p className="mt-1 text-sm text-slate-600">Sélectionne une réservation pour voir le détail.</p>
              </div>
              <div className="max-h-[calc(100vh-300px)] overflow-auto p-3">
                <div className="space-y-3">
                  {rows.map((b) => {
                    const isHourly = !isMidnightUtc(b.startDate) || !isMidnightUtc(b.endDate);
                    const service = b.service?.trim() ? b.service.trim() : "Service";
                    const isCancelled = b.status === "CANCELLED" || b.status === "PAYMENT_FAILED";
                    const isSelected = b.id === selectedId;
                    const blocking = pendingBlockingReason(b.status);
                    const location = sitterLocation(b.sitter);

                    const when = (() => {
                      if (!b.startDate) return "—";
                      if (isHourly) {
                        const day = formatDateOnly(b.startDate);
                        const start = formatTimeOnly(b.startDate);
                        const end = b.endDate ? formatTimeOnly(b.endDate) : "";
                        return `${day}${start ? ` • ${start}` : ""}${end ? ` → ${end}` : ""}`;
                      }

                      if (!b.endDate || b.endDate === b.startDate) return formatDateOnly(b.startDate);
                      return `${formatDateOnly(b.startDate)} → ${formatDateOnly(b.endDate)}`;
                    })();

                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(b.id);
                          setMobileDetailOpen(true);
                        }}
                        className={
                          "w-full rounded-3xl border p-4 text-left shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] transition" +
                          (isSelected
                            ? " border-[color-mix(in_srgb,var(--dogshift-blue),black_10%)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_96%)]"
                            : " border-slate-200 bg-white hover:bg-slate-50") +
                          (isCancelled ? " opacity-90" : "")
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="relative mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                              {b.sitter.avatarUrl && avatarIsSafe(b.sitter.avatarUrl) ? (
                                <Image src={b.sitter.avatarUrl} alt={b.sitter.name} fill className="object-cover" sizes="40px" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">
                                  {initialForName(b.sitter.name)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{b.sitter.name}</p>
                              <p className="mt-1 truncate text-xs text-slate-600">
                                {service} • {when}{location !== "—" ? ` • ${location}` : ""}
                              </p>
                              {blocking ? (
                                <p className="mt-2 truncate text-xs font-medium text-slate-500">{blocking}</p>
                              ) : (
                                <p className="mt-2 truncate font-mono text-[11px] text-slate-400">{b.id}</p>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <StatusPill status={uiStatusForBadge(b.status)} />
                            <p className={isCancelled ? "mt-2 text-sm font-semibold text-slate-600" : "mt-2 text-sm font-semibold text-slate-900"}>
                              {formatChfCents(b.amount)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className={mobileDetailOpen ? "block" : "hidden lg:block"}>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-600">Aperçu</p>
                  <h2 className="mt-2 truncate text-xl font-semibold tracking-tight text-slate-900">{selected?.sitter.name ?? "Réservation"}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {detail?.status ? <StatusPill status={uiStatusForBadge(detail.status)} /> : selected?.status ? <StatusPill status={uiStatusForBadge(selected.status)} /> : null}
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-slate-700">
                      {formatChfCents(detail?.amount ?? selected?.amount ?? 0)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileDetailOpen(false)}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 lg:hidden"
                  >
                    Retour
                  </button>

                  {selectedId ? (
                    <Link
                      href={`/account/bookings/${encodeURIComponent(selectedId)}`}
                      className="text-sm font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]"
                    >
                      Voir détails
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Résumé</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-slate-600">Service</p>
                      <p className="text-right font-semibold text-slate-900">{detail?.service ?? selected?.service ?? "—"}</p>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-slate-600">Statut</p>
                      <p className="text-right font-semibold text-slate-900">
                        {(() => {
                          const raw = detail?.status ?? selected?.status ?? "";
                          const blocking = pendingBlockingReason(raw);
                          if (blocking === "Paiement requis") return "Paiement requis — action attendue de votre part";
                          if (blocking === "En attente d’acceptation") return "Paiement effectué — en attente d’acceptation du sitter";
                          return statusLabel(raw).label;
                        })()}
                      </p>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-slate-600">Dates</p>
                      <p className="text-right font-semibold text-slate-900">
                        {selected?.startDate ? formatDateOnly(selected.startDate) : "—"}
                        {selected?.endDate ? ` → ${formatDateOnly(selected.endDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-slate-600">Lieu</p>
                      <p className="text-right font-semibold text-slate-900">{sitterLocation(detail?.sitter ?? selected?.sitter)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Référence</p>
                  <p className="mt-3 break-all font-mono text-xs text-slate-600">{selectedId ?? "—"}</p>
                  {detailLoading ? <p className="mt-3 text-xs font-medium text-slate-500">Chargement du détail…</p> : null}
                </div>
              </div>

              {detail?.message?.trim() ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Message</p>
                  <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{detail.message}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
