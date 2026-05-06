/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AccountPageSkeleton from "@/components/ui/AccountPageSkeleton";
import {
  ArchiveRestore,
  CalendarDays,
  MapPin,
  Trash2,
  Clock,
  CheckCircle2,
  CreditCard,
  Banknote,
  Info,
  ShieldCheck,
  HandCoins,
  Footprints,
  Home,
  Moon,
  MessageCircle,
  Hash,
  X,
} from "lucide-react";


type BookingListItem = {
  id: string;
  createdAt: string;
  archivedAt?: string | null;
  service: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  hasReview: boolean;
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

function summaryDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate) return "—";
  if (!endDate || endDate === startDate) return formatDateOnly(startDate);
  const sameDay = formatDateOnly(startDate) === formatDateOnly(endDate);
  if (sameDay) return formatDateOnly(startDate);
  return `${formatDateOnly(startDate)} → ${formatDateOnly(endDate)}`;
}

function summaryTimeRange(startDate: string | null, endDate: string | null) {
  if (!startDate) return "—";
  const isHourly = !isMidnightUtc(startDate) || !isMidnightUtc(endDate);
  if (!isHourly) return "—";
  const start = formatTimeOnly(startDate);
  const end = endDate ? formatTimeOnly(endDate) : "";
  return `${start}${end ? ` – ${end}` : ""}` || "—";
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

function statusClasses(status: string) {
  const s = statusLabel(status);
  const base = "inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold tracking-wide shadow-sm";
  if (s.tone === "emerald") return { label: s.label, classes: `${base} border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700` };
  if (s.tone === "amber") return { label: s.label, classes: `${base} border-amber-200/60 bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700` };
  if (s.tone === "rose") return { label: s.label, classes: `${base} border-rose-200/60 bg-gradient-to-r from-rose-50 to-rose-100/50 text-rose-700` };
  return { label: s.label, classes: `${base} border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100/50 text-slate-600` };
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
  if (tab === "ALL") {
    return status === "PENDING_ACCEPTANCE" || status === "PAID" || status === "CONFIRMED";
  }
  if (tab === "PENDING") {
    return status === "PENDING_ACCEPTANCE" || status === "PAID";
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

function canLeaveReview(booking: BookingListItem) {
  if (booking.hasReview) return false;
  if (String(booking.status ?? "") !== "CONFIRMED") return false;
  if (!booking.endDate) return false;
  const endTs = new Date(booking.endDate).getTime();
  return Number.isFinite(endTs) && Date.now() > endTs;
}

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function AccountBookingsContent() {
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<TabKey>("ALL");
  const [search, setSearch] = useState("");
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1000);
    return () => window.clearTimeout(t);
  }, [copied]);

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
     
  }, [isLoaded, isSignedIn]);

  const activeTabFromQuery = useMemo<TabKey>(() => {
    const tabQ = searchParams?.get("tab");
    if (tabQ) return tabFromQuery(tabQ);
    const statusQ = searchParams?.get("status");
    if (statusQ) return tabFromQuery(statusQ);
    return "ALL";
  }, [searchParams]);

  useEffect(() => {
    setCurrentTab(activeTabFromQuery);
  }, [activeTabFromQuery]);


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

  function selectTab(key: TabKey) {
    setCurrentTab(key);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("status");
    params.delete("pending");
    params.set("tab", key.toLowerCase());
    params.delete("id");
    router.replace(`/account/bookings?${params.toString()}`);
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = bookings
      .filter((b) => matchesTab(b, currentTab))
      .filter((b) => (currentTab === "PENDING" ? matchesPendingSubfilter(b.status, pendingSubfilter) : true))
      .filter((b) => !q || b.sitter.name.toLowerCase().includes(q) || (b.service ?? "").toLowerCase().includes(q));
    return filtered.slice().sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
  }, [bookings, currentTab, pendingSubfilter, search]);

  useEffect(() => {
    if (loading) return;
    if (rows.length === 0) {
      if (selectedId) setSelectedId(null);
      setMobileDetailOpen(false);
      setDetail(null);
      return;
    }

    if (!selectedId || !rows.some((r) => r.id === selectedId)) {
      const q = searchParams?.get("id");
      const desired = typeof q === "string" && q.trim() ? q.trim() : null;
      if (desired && rows.some((r) => r.id === desired)) {
        setSelectedId(desired);
      } else {
        setSelectedId(rows[0]!.id);
      }
    }
  }, [loading, rows]); // Intentionally omitting selectedId and searchParams to prevent loops

  useEffect(() => {
    setIsFlipped(false);
    if (!selectedId) {
      setDetail(null);
      return;
    }

    const nextTab = currentTab.toLowerCase();
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("status");
    params.set("tab", nextTab);
    params.set("id", selectedId);
    
    const newUrl = `/account/bookings?${params.toString()}`;
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [currentTab, selectedId, searchParams]);

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

  async function archivePendingBooking(bookingId: string) {
    if (!bookingId || deletingId) return;
    setDeletingId(bookingId);
    try {
      const res = await fetch(`/api/account/bookings/${encodeURIComponent(bookingId)}/archive`, { method: "POST" });
      const payload = (await res.json()) as { ok?: boolean; archivedAt?: string };
      if (!res.ok || !payload.ok) {
        setError("Impossible de supprimer cette réservation.");
        return;
      }
      const archivedAt = typeof payload.archivedAt === "string" && payload.archivedAt.trim() ? payload.archivedAt : new Date().toISOString();
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, archivedAt } : b)));
      if (selectedId === bookingId) {
        setDetail((current) => current);
      }
      setConfirmDeleteId(null);
    } catch {
      setError("Impossible de supprimer cette réservation.");
    } finally {
      setDeletingId(null);
    }
  }

  async function unarchiveOwnerBooking(bookingId: string) {
    if (!bookingId || unarchivingId) return;
    setUnarchivingId(bookingId);
    setError(null);
    try {
      const res = await fetch(`/api/account/bookings/${encodeURIComponent(bookingId)}/unarchive`, { method: "POST" });
      const payload = (await res.json()) as { ok?: boolean };
      if (!res.ok || !payload.ok) {
        setError("Impossible de désarchiver cette réservation.");
        return;
      }
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, archivedAt: null } : b)));
    } catch {
      setError("Impossible de désarchiver cette réservation.");
    } finally {
      setUnarchivingId(null);
    }
  }

  if (!isLoaded || !isSignedIn) return <AccountPageSkeleton />;

  return (
    <div className="relative" data-testid="account-bookings-page">
      <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
        <section className={mobileDetailOpen ? "hidden min-w-0 lg:block" : "min-w-0 block"}>
          <div className="rounded-3xl border border-slate-100 bg-white/60 p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-600">Mon compte</p>
                <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
                  <CalendarDays className="h-6 w-6 text-[var(--dogshift-blue)]" aria-hidden="true" />
                  <span>Réservations</span>
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{counts.PENDING}</span> en attente
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="inline-flex rounded-2xl border border-slate-100 bg-slate-50/50 p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => { if (currentTab === "ARCHIVED") selectTab("ALL"); }}
                  className={`h-9 rounded-xl px-4 text-sm font-bold transition-all duration-300 ${
                    currentTab !== "ARCHIVED" ? "bg-white text-[var(--dogshift-blue)] shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                  }`}
                >
                  Réservations
                </button>
                <button
                  type="button"
                  onClick={() => selectTab("ARCHIVED")}
                  className={`h-9 rounded-xl px-4 text-sm font-bold transition-all duration-300 ${
                    currentTab === "ARCHIVED" ? "bg-white text-[var(--dogshift-blue)] shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                  }`}
                >
                  Archivées
                </button>
              </div>
            </div>

            <div className={`mt-6 grid md:items-center transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              currentTab === "ARCHIVED"
                ? "gap-0 md:grid-cols-[0px_1fr]"
                : "gap-3 md:grid-cols-[140px_1fr]"
            }`}>
              <div className={`transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                currentTab === "ARCHIVED"
                  ? "opacity-0 pointer-events-none h-0 md:h-10 w-full md:w-[140px] -translate-x-4 md:translate-x-0 overflow-hidden"
                  : "opacity-100 pointer-events-auto h-10 w-full md:w-[140px] translate-x-0"
              }`}>
                <label className="sr-only" htmlFor="owner-bookings-filter">
                  Statut
                </label>
                <div className="relative">
                  <select
                    id="owner-bookings-filter"
                    value={currentTab}
                    onChange={(e) => selectTab(e.target.value as TabKey)}
                    className="h-10 w-full md:w-[140px] appearance-none rounded-2xl border border-slate-100 bg-white pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] hover:bg-slate-50 cursor-pointer"
                  >
                    <option value="ALL">Tous</option>
                    <option value="PENDING">En attente</option>
                    <option value="CONFIRMED">Confirmées</option>
                    <option value="CANCELLED">Annulées / refusées</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="relative flex-1 group transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[var(--dogshift-blue)]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.5 3a5.5 5.5 0 104.384 8.824l2.146 2.146a.75.75 0 101.06-1.06l-2.146-2.146A5.5 5.5 0 008.5 3zm-4 5.5a4 4 0 117.999.001A4 4 0 014.5 8.5z" clipRule="evenodd" />
                  </svg>
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="h-10 w-full appearance-none rounded-2xl border border-slate-100 bg-white pl-10 pr-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] hover:bg-slate-50"
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-900">
              <p>{error}</p>
              {error.includes("401") ? (
                <Link
                  href="/login"
                  className="mt-3 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]"
                >
                  Se connecter
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadBookings()}
                  className="mt-3 inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50"
                >
                  Réessayer
                </button>
              )}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-[96px] rounded-2xl border border-slate-100 bg-white/60 p-4 shadow-sm backdrop-blur-xl">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100/80 animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-2/3 rounded-lg bg-slate-100/80 animate-pulse" />
                      <div className="mt-2 h-3 w-1/2 rounded-lg bg-slate-100/80 animate-pulse" />
                      <div className="mt-3 h-5 w-24 rounded-full bg-slate-100/80 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-slate-100 bg-white/60 p-8 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)] backdrop-blur-xl text-center">
              <p className="text-sm font-semibold text-slate-900">{emptyCopy(currentTab)}</p>
              <p className="mt-2 text-sm text-slate-600">
                {currentTab === "ALL"
                  ? "Quand tu réserves un dogsitter, la demande apparaîtra ici automatiquement."
                  : "Change d’onglet pour voir d’autres réservations ou démarre une nouvelle demande."}
              </p>
              {currentTab === "ALL" ? (
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
            <div className="mt-6">
              <div className="max-h-[calc(100vh-520px)] space-y-3 overflow-auto px-1 pt-3 pb-8 sm:pr-1 sm:pl-3" style={{ scrollbarWidth: 'thin' }}>
                <div role="listbox" aria-label="Liste des réservations" className="space-y-2">
                  {rows.map((b) => {
                  const service = b.service?.trim() ? b.service.trim() : "Service";
                  const isCancelled = b.status === "CANCELLED" || b.status === "PAYMENT_FAILED";
                  const canDelete = false; // DRAFT/PENDING_PAYMENT bookings are hidden server-side
                  const canUnarchive = false;
                  const isSelected = b.id === selectedId;

                  return (
                    <div
                      key={b.id}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedId(b.id);
                        setMobileDetailOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(b.id);
                          setMobileDetailOpen(true);
                        }
                      }}
                      className={
                        "group relative w-full rounded-2xl border p-4 text-left transition-all duration-300 ease-out cursor-pointer" +
                        (isSelected
                          ? " border-[var(--dogshift-blue)] ring-1 ring-[var(--dogshift-blue)] shadow-md bg-[color-mix(in_srgb,var(--dogshift-blue),white_97%)]"
                          : " border-slate-100 bg-white shadow-sm hover:border-slate-200 hover:bg-slate-50/80 hover:shadow-md") +
                        (isCancelled ? " opacity-75" : "") +
                        " focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dogshift-blue)]"
                      }
                    >
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setConfirmDeleteId(b.id);
                          }}
                          className="pointer-events-none absolute -left-2 -top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 opacity-0 shadow-sm transition group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-slate-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : null}
                      {canUnarchive ? (
                        <button
                          type="button"
                          title="Remettre dans les réservations actives"
                          aria-label="Désarchiver"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void unarchiveOwnerBooking(b.id);
                          }}
                          disabled={unarchivingId === b.id}
                          className="pointer-events-none absolute -right-2 -bottom-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 opacity-0 shadow-sm transition group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : null}
                      <div className="flex items-start gap-3">
                        {b.sitter.avatarUrl && avatarIsSafe(b.sitter.avatarUrl) ? (
                          <div className="relative mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 shadow-sm">
                            <Image src={b.sitter.avatarUrl} alt={b.sitter.name} fill className="object-cover" sizes="36px" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                            {initialForName(b.sitter.name)}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-slate-900 group-hover:text-[var(--dogshift-blue)] transition-colors duration-300">{b.sitter.name}</p>
                              <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                {service === "Promenade" && <Footprints className="h-3.5 w-3.5 text-slate-400" />}
                                {service === "Garde" && <Home className="h-3.5 w-3.5 text-slate-400" />}
                                {service === "Pension" && <Moon className="h-3.5 w-3.5 text-slate-400" />}
                                <span className="truncate">{service}</span>
                              </div>
                            </div>

                            <div className="shrink-0 text-right transition-all duration-300">
                              <p className="text-sm font-semibold text-slate-900">{formatChfCents(b.amount)}</p>
                              <div className="mt-2 flex justify-end">
                                {(() => { const m = statusClasses(uiStatusForBadge(b.status)); return <span className={m.classes}>{m.label}</span>; })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          )}
        </section>

        <aside className={mobileDetailOpen ? "block min-w-0" : "hidden min-w-0 lg:block"}>
          <div className="sticky top-0">
            <div key={selectedId || "none"} className="animate-in fade-in slide-in-from-bottom-2 duration-500 rounded-3xl border border-slate-100 bg-white/60 p-4 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6 transition-all">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="min-w-0">
                <p className="truncate text-xl font-bold tracking-tight text-slate-900">{selected?.sitter.name ?? "Réservation"}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {(() => {
                    const st = detail?.status ?? selected?.status ?? "";
                    const effectiveStatus = uiStatusForBadge(st);
                    const s = statusLabel(effectiveStatus);
                    const colors = s.tone === "emerald" ? "border-emerald-200 bg-emerald-50/50 text-emerald-800"
                      : s.tone === "amber" ? "border-amber-200 bg-amber-50/50 text-amber-800"
                      : s.tone === "rose" ? "border-rose-200 bg-rose-50/50 text-rose-800"
                      : "border-slate-200 bg-slate-50 text-slate-700";
                    const iconColor = s.tone === "emerald" ? "text-emerald-600" : s.tone === "amber" ? "text-amber-600" : s.tone === "rose" ? "text-rose-600" : "text-slate-500";
                    const Icon = s.tone === "emerald" ? CheckCircle2 : s.tone === "amber" ? Clock : s.tone === "rose" ? CreditCard : CalendarDays;
                    return (
                      <div className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 shadow-sm ${colors}`}>
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                        <span className="text-[14px] font-bold tracking-wide">{s.label}</span>
                      </div>
                    );
                  })()}
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 shadow-sm">
                    <Banknote className="h-5 w-5 text-slate-500" />
                    <span className="text-[15px] font-bold tracking-wide text-slate-900">{formatChfCents(detail?.amount ?? selected?.amount ?? 0)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileDetailOpen(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 hover:scale-105 active:scale-95 lg:hidden"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-200">
              <section className="group relative bg-white z-10" style={{ perspective: "1500px" }}>
                <div 
                  className="relative w-full transition-transform duration-[800ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
                  style={{ 
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
                  }}
                >
                  {/* FRONT FACE */}
                  <div 
                    className="w-full p-5 sm:p-6"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <p className="text-sm font-bold text-slate-900 flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                        Détails de la réservation
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsFlipped(true)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-[var(--dogshift-blue)] hover:scale-110 active:scale-95"
                        title="Voir la référence"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Service & Date
                      </p>
                      <p className="text-[15px] font-bold text-slate-900">{detail?.service ?? selected?.service ?? "—"}</p>
                      <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">{summaryDateRange(selected?.startDate ?? null, selected?.endDate ?? null)}</p>
                      {summaryTimeRange(selected?.startDate ?? null, selected?.endDate ?? null) !== "—" ? (
                        <p className="text-xs font-medium text-slate-500 mt-0.5">{summaryTimeRange(selected?.startDate ?? null, selected?.endDate ?? null)}</p>
                      ) : null}
                    </div>

                    <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                        <Banknote className="h-3.5 w-3.5" />
                        Paiement
                      </p>
                      <p className="text-[15px] font-bold text-slate-900">
                        {formatChfCents(detail?.amount ?? selected?.amount ?? 0)}
                        <span className="text-xs text-slate-400 font-medium ml-1">({formatChfCents(detail?.platformFeeAmount ?? selected?.platformFeeAmount ?? 0)} de frais)</span>
                      </p>
                      <p className="text-xs font-medium text-slate-600 mt-1">Sécurisé via Stripe</p>
                    </div>
                  </div>

                  {sitterLocation(detail?.sitter ?? selected?.sitter) !== "—" ? (
                    <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50/50 px-4 py-3 border border-slate-100/50">
                      <MapPin className="h-4 w-4 shrink-0 text-[var(--dogshift-blue)]" aria-hidden="true" />
                      <p className="text-sm font-semibold text-slate-900">{sitterLocation(detail?.sitter ?? selected?.sitter)}</p>
                    </div>
                  ) : null}
                  </div>

                  {/* BACK FACE */}
                  <div 
                    className={`absolute inset-0 w-full h-full p-5 sm:p-6 bg-slate-50 flex flex-col ${!isFlipped ? 'pointer-events-none' : ''}`}
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                          <Hash className="h-4 w-4" />
                        </span>
                        Référence de transaction
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsFlipped(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 hover:scale-110 active:scale-95 shadow-sm"
                        title="Retour"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-4 mt-2">
                      <p className="text-xs font-medium text-slate-500">Identifiant unique à communiquer au support en cas de besoin.</p>
                      
                      <div className="flex items-center justify-between gap-3 bg-white p-2 pl-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="font-mono text-xs font-medium text-slate-700 break-all">{selected?.id}</p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (selected?.id) {
                              const ok = await copyToClipboard(selected.id);
                              setCopied(ok);
                            }
                          }}
                          className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 border border-slate-100"
                        >
                          {copied ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4 text-emerald-600" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {detail?.message?.trim() ? (
                <section className="group border-t border-slate-100 bg-white p-5 transition-colors hover:bg-slate-50/50">
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </span>
                    Message
                  </p>
                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <p className="whitespace-pre-line text-sm text-slate-700 italic">&ldquo;{detail.message}&rdquo;</p>
                  </div>
                </section>
              ) : null}

              <section className="border-t border-slate-100 bg-slate-50/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50/80">
                <div className="w-full sm:w-auto flex-shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href={selectedId ? `/account/bookings/${encodeURIComponent(selectedId)}` : "#"}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Voir la conversation
                  </Link>
                  {selected &&
                  selected.archivedAt &&
                  (selected.status === "DRAFT" || selected.status === "PENDING_PAYMENT") ? (
                    <button
                      type="button"
                      onClick={() => void unarchiveOwnerBooking(selected.id)}
                      disabled={unarchivingId === selected.id}
                      className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                      {unarchivingId === selected.id ? "Désarchivage…" : "Désarchiver"}
                    </button>
                  ) : null}
                </div>

                {(() => {
                  const b = selected;
                  if (!b) return null;
                  const reviewEligible = canLeaveReview(b);
                  if (!reviewEligible && !b.hasReview) return null;
                  return (
                    <div className="w-full sm:w-auto flex justify-end">
                      {b.hasReview ? (
                        <Link
                          href={`/account/bookings/${encodeURIComponent(b.id)}/review`}
                          className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 active:scale-95"
                        >
                          Avis laissé
                        </Link>
                      ) : (
                        <Link
                          href={`/account/bookings/${encodeURIComponent(b.id)}/review`}
                          className="inline-flex items-center justify-center rounded-xl bg-[var(--dogshift-blue)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] active:scale-95"
                        >
                          Laisser un avis
                        </Link>
                      )}
                    </div>
                  );
                })()}
              </section>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-100 bg-white/60 p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:shadow-md hover:border-slate-200">
              <p className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Info className="h-4 w-4" />
                </span>
                Comment ça marche ?
              </p>

              <div className="space-y-6">
                <div className="flex gap-4 items-start">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 border border-slate-100 shadow-sm mt-0.5">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">1. Réservation</p>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">Choisis un dogsitter et réserve. Le paiement est sécurisé par Stripe.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 border border-slate-100 shadow-sm mt-0.5">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">2. Acceptation</p>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">Le sitter confirme ta demande. Le créneau est bloqué et la réservation est confirmée.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 border border-slate-100 shadow-sm mt-0.5">
                    <HandCoins className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">3. Prestation</p>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">Le sitter s&apos;occupe de ton chien. Tu peux laisser un avis après le service.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
      </div>

      {confirmDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_30px_90px_-55px_rgba(2,6,23,0.45)] sm:p-7">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Supprimer cette réservation ?</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Cette action retirera la réservation en attente de ta liste. Tu pourras refaire une demande plus tard si besoin.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void archivePendingBooking(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === confirmDeleteId ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AccountBookingsPage() {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <AccountBookingsContent />
    </Suspense>
  );
}
