"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

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

type Contact = { id: string; name: string; avatarUrl: string | null };

export default function HostMessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── "New conversation" picker (the purple + button) ──────────────────────
  // Lets the sitter start a chat with an owner they already have a
  // booking/request with (founder: "un petit + violet pour créer une nouvelle
  // conversation"). Contacts are derived from /api/host/requests.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRaised, setPickerRaised] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const res = await fetch("/api/host/requests", { method: "GET", cache: "no-store" });
      const payload = (await res.json()) as {
        ok?: boolean;
        bookings?: Array<{ owner?: { id?: string; name?: string; avatarUrl?: string | null } }>;
      };
      const seen = new Set<string>();
      const list: Contact[] = [];
      for (const b of payload.bookings ?? []) {
        const o = b.owner;
        if (!o?.id || seen.has(o.id)) continue;
        seen.add(o.id);
        list.push({ id: o.id, name: o.name?.trim() || "Client", avatarUrl: o.avatarUrl ?? null });
      }
      setContacts(list);
    } catch {
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
    requestAnimationFrame(() => setPickerRaised(true));
    void loadContacts();
  }, [loadContacts]);

  const closePicker = useCallback(() => {
    setPickerRaised(false);
    window.setTimeout(() => setPickerOpen(false), 280);
  }, []);

  const startConversation = useCallback(
    async (ownerId: string) => {
      if (startingId) return;
      setStartingId(ownerId);
      try {
        const res = await fetch("/api/host/messages/conversations/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId }),
        });
        const payload = (await res.json()) as { ok?: boolean; conversationId?: string };
        if (res.ok && payload.ok && payload.conversationId) {
          closePicker();
          router.push(`/host/messages/${encodeURIComponent(payload.conversationId)}`);
        }
      } catch {
        // swallow — button re-enables below
      } finally {
        setStartingId(null);
      }
    },
    [startingId, closePicker, router],
  );

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
    void loadConversations();
  }, []);

  const m = pathname.match(/^\/host\/messages\/([^/?#]+)/);
  const activeId = m && m[1] ? decodeURIComponent(m[1]) : null;

  useEffect(() => {
    if (!activeId) return;
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c)));
  }, [pathname, activeId]);

  const rows = useMemo(() => {
    return conversations.slice().sort((a, b) => {
      const ta = new Date(a.lastMessageAt ?? a.updatedAt).getTime();
      const tb = new Date(b.lastMessageAt ?? b.updatedAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
  }, [conversations]);

  return (
    <div className="flex h-[calc(100vh-80px-max(var(--ds-bottom-nav-h,0px),88px))] lg:h-[calc(100vh-80px)] flex-col bg-white -mx-4 -mt-4 sm:mx-0 sm:mt-0 sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]" data-testid="host-messages-layout">
        <div className="flex-1 min-h-0 relative">
            <div className="grid h-full gap-0 lg:grid-cols-[360px_1fr]">
            <aside
              className={
                "h-full flex-col border-slate-200 p-4 sm:p-6 " +
                (activeId ? "hidden lg:flex " : "flex ") +
                "lg:border-r"
              }
            >
              {/* Title top-left. The "+" to start a new conversation is a
                  floating FAB anchored bottom-right above the nav (see below) —
                  founder: "le + je le veux en bas a droite au dessus de la nav
                  barre". */}
              <div className="mb-3">
                <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900">
                  Conversations
                </h1>
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
                /* Neon glide skeleton — conversation rows matching the real
                   list item shape (avatar + lines) and the route-level
                   DashboardSkeleton, so loading is one continuous shimmer. */
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
                      <div className="ds-skel h-12 w-12 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="ds-skel h-4 w-1/2 rounded-lg" />
                        <div className="ds-skel h-3 w-3/4 rounded-lg" />
                        <div className="ds-skel h-3 w-1/4 rounded-lg" />
                      </div>
                    </div>
                  ))}
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
                            ? "block w-full border-b border-slate-100 bg-[color-mix(in_srgb,var(--dogshift-blue),white_96%)] px-4 py-3 text-left"
                            : "block w-full border-b border-slate-100 bg-white px-4 py-3 text-left hover:bg-slate-50"
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                              <div className="relative mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
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

            <section className={"h-full min-h-0 p-0 sm:p-6 " + (activeId ? "block" : "hidden lg:block")}>{children}</section>
            </div>
        </div>

        {/* ── Floating "+" FAB — bottom-right, above the bottom nav ──
            Shown on the conversation LIST view (hidden once a thread is open so
            it doesn't cover the chat). On desktop it's hidden (lg) since the
            list is always visible alongside the thread. */}
        {!activeId ? (
          <button
            type="button"
            onClick={openPicker}
            aria-label="Nouvelle conversation"
            style={{
              touchAction: "manipulation",
              bottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 16px)",
            }}
            className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-[0_10px_30px_-6px_rgba(124,58,237,0.65)] active:scale-95 lg:hidden"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        ) : null}

        {/* ── New-conversation picker (bottom sheet) ── */}
        {pickerOpen ? (
          <div className="fixed inset-0 z-[95] flex flex-col justify-end">
            <button
              type="button"
              aria-label="Fermer"
              onClick={closePicker}
              className="absolute inset-0 bg-black/40 transition-opacity duration-300"
              style={{ opacity: pickerRaised ? 1 : 0 }}
            />
            <div
              className="relative w-full rounded-t-[28px] bg-white px-5 pt-3 shadow-2xl transition-transform duration-300 ease-out"
              style={{
                transform: pickerRaised ? "translateY(0)" : "translateY(100%)",
                maxHeight: "75dvh",
                overflowY: "auto",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
              }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Nouvelle conversation</h2>
                <button
                  type="button"
                  onClick={closePicker}
                  aria-label="Fermer"
                  style={{ touchAction: "manipulation" }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:scale-95"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {contactsLoading ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl p-2">
                      <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-4 w-1/2 animate-pulse rounded-lg bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold text-slate-900">Aucun contact pour l’instant</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Les clients apparaîtront ici dès que tu auras une demande de réservation.
                  </p>
                </div>
              ) : (
                <div className="pb-1">
                  {contacts.map((ct) => (
                    <button
                      key={ct.id}
                      type="button"
                      disabled={Boolean(startingId)}
                      onClick={() => void startConversation(ct.id)}
                      style={{ touchAction: "manipulation" }}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left active:bg-slate-50 disabled:opacity-60"
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
                        {ct.avatarUrl && avatarIsSafe(ct.avatarUrl) ? (
                          <Image src={ct.avatarUrl} alt={ct.name} fill className="object-cover" sizes="40px" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">
                            {initialForName(ct.name)}
                          </div>
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                        {ct.name}
                      </span>
                      {startingId === ct.id ? (
                        <span className="text-xs font-medium text-slate-400">Ouverture…</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
    </div>
  );
}
