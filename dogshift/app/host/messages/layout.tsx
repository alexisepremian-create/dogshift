"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { MessageCircle } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";

type ConversationListItem = {
  id: string;
  bookingId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  updatedAt: string;
  owner: { id: string; name: string; avatarUrl: string | null };
  booking: { service: string | null; startDate: string | null; endDate: string | null } | null;
  unreadCount: number;
};

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

function formatDateTime(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("fr-CH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function formatDateOnly(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", year: "numeric" }).format(dt);
}

export default function HostMessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadConversations() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/host/messages/conversations", { method: "GET", cache: "no-store" });
      const payload = (await res.json()) as { ok?: boolean; conversations?: ConversationListItem[]; error?: string };
      if (!res.ok || !payload.ok) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") {
          setError("Connexion requise (401). ");
          setConversations([]);
          return;
        }
        if (res.status === 403 || payload.error === "FORBIDDEN") {
          setError("Accès refusé (403).");
          setConversations([]);
          return;
        }
        if (res.status === 404 || payload.error === "NOT_FOUND") {
          setError("Introuvable (404).");
          setConversations([]);
          return;
        }
        if (res.status >= 500) {
          setError("Erreur serveur (500). ");
          setConversations([]);
          return;
        }
        setError("Impossible de charger tes messages.");
        setConversations([]);
        return;
      }
      setConversations(Array.isArray(payload.conversations) ? payload.conversations : []);
    } catch {
      setError("Impossible de charger tes messages.");
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    const m = pathname.match(/^\/host\/messages\/([^/?#]+)/);
    const activeId = m && m[1] ? decodeURIComponent(m[1]) : null;
    if (!activeId) return;
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c)));
  }, [pathname]);

  const rows = useMemo(() => {
    return conversations.slice().sort((a, b) => {
      const ta = new Date(a.lastMessageAt ?? a.updatedAt).getTime();
      const tb = new Date(b.lastMessageAt ?? b.updatedAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
  }, [conversations]);

  if (!isLoaded) return null;
  if (!isSignedIn) return null;

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="host-messages-layout">
      <SunCornerGlow variant="sitterMessages" />

      <div className="relative z-10 grid gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-600">Tableau de bord</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              <MessageCircle className="h-6 w-6 text-slate-700" aria-hidden="true" />
              <span>Messages</span>
            </h1>
            <div className="mt-3 flex min-h-[32px] items-center">
              <p className="text-sm text-slate-600">{rows.length} conversation(s)</p>
            </div>
          </div>
        </div>

        <div className="relative h-[calc(100vh-140px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <button
            type="button"
            aria-label="Rafraîchir"
            title="Rafraîchir"
            onClick={() => void loadConversations()}
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3.1-6.8" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
          <div className="grid h-full gap-0 lg:grid-cols-[360px_1fr]">
            <aside className="flex h-full flex-col border-b border-slate-200 p-4 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between">
                <p className="px-2 pb-3 text-xs font-semibold text-slate-600">Boîte de réception</p>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-900">
                  <p>{error}</p>
                  {error.includes("401") ? (
                    <Link
                      href="/login"
                      className="mt-3 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                    >
                      Se connecter
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Chargement…</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Aucune conversation</p>
                  <p className="mt-1 text-sm text-slate-600">Les conversations apparaîtront quand un client te contacte.</p>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {rows.map((c) => {
                    const subtitle = c.booking?.service
                      ? `${c.booking.service} • ${c.booking.startDate ? formatDateOnly(c.booking.startDate) : "—"}`
                      : "Conversation";
                    const href = `/host/messages/${encodeURIComponent(c.id)}`;
                    const active = pathname === href;
                    return (
                      <Link
                        key={c.id}
                        href={href}
                        onClick={() => {
                          setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
                        }}
                        className={
                          active
                            ? "block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
                            : "block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="relative mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                              {c.owner.avatarUrl && avatarIsSafe(c.owner.avatarUrl) ? (
                                <Image src={c.owner.avatarUrl} alt={c.owner.name} fill className="object-cover" sizes="40px" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">
                                  {initialForName(c.owner.name)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{c.owner.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500 truncate">{subtitle}</p>
                              <p className="mt-2 text-xs text-slate-500 truncate">
                                {c.lastMessagePreview?.trim() ? c.lastMessagePreview : "Aucun message"}
                              </p>
                              <p className="mt-2 text-xs text-slate-500">{formatDateTime(c.lastMessageAt ?? c.updatedAt)}</p>
                            </div>
                          </div>
                          {c.unreadCount > 0 ? (
                            <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-rose-600 px-2 text-xs font-semibold text-white">
                              {c.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </aside>

            <section className="h-full min-h-0 p-4 sm:p-6">{children}</section>
          </div>
        </div>
      </div>
    </div>
  );
}
