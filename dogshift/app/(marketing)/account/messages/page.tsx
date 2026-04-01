"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { MessageCircle, RefreshCw } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";

type ConversationListItem = {
  id: string;
  bookingId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  updatedAt: string;
  sitter: { sitterId: string; name: string; avatarUrl: string | null };
  booking: { service: string | null; startDate: string | null; endDate: string | null } | null;
  unreadCount: number;
};

type ConversationHeader = {
  id: string;
  sitter: { sitterId: string; name: string; avatarUrl: string | null };
  bookingId: string | null;
};

type MessageItem = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
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

export default function AccountMessagesPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadHeader, setThreadHeader] = useState<ConversationHeader | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
    }
  }, [isLoaded, isSignedIn, router]);

  async function loadConversations() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/messages/conversations", { method: "GET" });
      const payload = (await res.json()) as { ok?: boolean; conversations?: ConversationListItem[]; error?: string };
      if (!res.ok || !payload.ok) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") {
          setError("Connexion requise (401). ");
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

  async function loadThread(conversationId: string) {
    setThreadLoading(true);
    setThreadError(null);
    try {
      const res = await fetch(`/api/account/messages/conversations/${encodeURIComponent(conversationId)}`, { method: "GET" });
      const payload = (await res.json()) as {
        ok?: boolean;
        viewerId?: string;
        conversation?: ConversationHeader;
        messages?: MessageItem[];
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.conversation) {
        setThreadHeader(null);
        setMessages([]);
        setViewerId(null);
        if (res.status === 401 || payload.error === "UNAUTHORIZED") setThreadError("Connexion requise (401). ");
        else if (res.status === 403 || payload.error === "FORBIDDEN") setThreadError("Accès refusé (403).");
        else if (res.status === 404 || payload.error === "NOT_FOUND") setThreadError("Introuvable (404).");
        else if (res.status >= 500) setThreadError("Erreur serveur (500). ");
        else setThreadError("Conversation introuvable.");
        return;
      }
      setThreadHeader(payload.conversation);
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setViewerId(typeof payload.viewerId === "string" && payload.viewerId.trim() ? payload.viewerId.trim() : null);

      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
    } catch {
      setThreadHeader(null);
      setMessages([]);
      setViewerId(null);
      setThreadError("Impossible de charger la conversation.");
    } finally {
      setThreadLoading(false);
    }
  }

  async function refreshAll() {
    await loadConversations();
    if (selectedId) {
      await loadThread(selectedId);
    }
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  const rows = useMemo(() => {
    return conversations.slice().sort((a, b) => {
      const ta = new Date(a.lastMessageAt ?? a.updatedAt).getTime();
      const tb = new Date(b.lastMessageAt ?? b.updatedAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
  }, [conversations]);

  const requestedConversationId = useMemo(() => {
    const raw = searchParams?.get("conversationId");
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }, [searchParams]);

  useEffect(() => {
    if (!requestedConversationId) return;
    if (loading) return;
    if (!rows.some((c) => c.id === requestedConversationId)) return;
    if (selectedId === requestedConversationId && threadHeader) return;
    setSelectedId(requestedConversationId);
    void loadThread(requestedConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, requestedConversationId, rows]);

  useEffect(() => {
    if (loading) return;
    if (rows.length === 0) {
      setSelectedId(null);
      setThreadHeader(null);
      setMessages([]);
      setViewerId(null);
      setThreadError(null);
      return;
    }

    if (selectedId && !rows.some((c) => c.id === selectedId)) {
      setSelectedId(null);
      setThreadHeader(null);
      setMessages([]);
      setViewerId(null);
      setThreadError(null);
    }
  }, [loading, rows, selectedId]);

  const canSend = text.trim().length > 0 && !sending;

  async function send() {
    if (!selectedId) return;
    const body = text.trim();
    if (!body) return;
    if (sending) return;

    setSending(true);
    setThreadError(null);
    try {
      const res = await fetch(`/api/account/messages/conversations/${encodeURIComponent(selectedId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const payload = (await res.json()) as { ok?: boolean; message?: MessageItem; error?: string };
      if (!res.ok || !payload.ok || !payload.message) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") {
          setThreadError("Connexion requise (401). ");
          return;
        }
        setThreadError(`Impossible d’envoyer le message (${payload.error ?? res.status}).`);
        return;
      }
      setText("");
      setMessages((prev) => [...prev, payload.message!]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                lastMessageAt: payload.message!.createdAt,
                lastMessagePreview: payload.message!.body,
              }
            : c
        )
      );
    } catch {
      setThreadError("Impossible d’envoyer le message.");
    } finally {
      setSending(false);
    }
  }

  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
        <p className="text-sm font-semibold text-slate-900">Connexion requise (401).</p>
        <p className="mt-2 text-sm text-slate-600">Connecte-toi pour accéder à tes messages.</p>
        <div className="mt-5">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid overflow-hidden" data-testid="account-messages-page">
      <SunCornerGlow variant="ownerMessages" />

      <div className="relative z-10 grid">
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
              onClick={() => void loadConversations()}
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
          <p className="mt-2 text-sm text-slate-600">Nous récupérons tes conversations.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
          <p className="text-sm font-semibold text-slate-900">Aucune conversation</p>
          <p className="mt-2 text-sm text-slate-600">Quand tu contactes un dogsitter, la conversation apparaîtra ici.</p>
          <div className="mt-5">
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
            >
              Trouver un sitter
            </Link>
          </div>
        </div>
      ) : (
        <div className="relative h-[calc(100vh-110px)] lg:h-[calc(100vh-140px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <div className="grid h-full gap-0 lg:grid-cols-[360px_1fr]">
            <section
              className={
                "h-full flex-col p-4 sm:p-6 " +
                (selectedId ? "hidden lg:flex " : "flex ") +
                "lg:border-r lg:border-slate-200"
              }
            >
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {rows.map((c) => {
                  const subtitle = c.booking?.service
                    ? `${c.booking.service} • ${c.booking.startDate ? formatDateOnly(c.booking.startDate) : "—"}`
                    : "Conversation";
                  const active = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                        setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
                        const params = new URLSearchParams(searchParams?.toString() ?? "");
                        params.set("conversationId", c.id);
                        router.replace(`/account/messages?${params.toString()}`);
                        void loadThread(c.id);
                      }}
                      className={
                        "block w-full rounded-2xl border px-4 py-3 text-left transition" +
                        (active
                          ? " border-[color-mix(in_srgb,var(--dogshift-blue),black_10%)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_96%)]"
                          : " border-slate-200 bg-white hover:bg-slate-50")
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="relative mt-0.5 h-10 w-10 flex-none overflow-hidden rounded-2xl bg-slate-100">
                            {c.sitter.avatarUrl && avatarIsSafe(c.sitter.avatarUrl) ? (
                              <Image src={c.sitter.avatarUrl} alt={c.sitter.name} fill className="object-cover" sizes="40px" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">
                                {initialForName(c.sitter.name)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{c.sitter.name}</p>
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
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={"h-full min-h-0 flex-col p-0 lg:p-6 lg:border-l lg:border-t-0 " + (selectedId ? "flex" : "hidden lg:flex")}>
              {threadError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                  <p className="text-sm font-semibold text-rose-900">{threadError}</p>
                </div>
              ) : !selectedId ? (
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">Sélectionne une conversation</p>
                  <p className="mt-1 text-sm text-slate-600">Clique sur une conversation à gauche pour l’ouvrir.</p>
                </div>
              ) : threadLoading || !threadHeader ? (
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">Chargement…</p>
                  <p className="mt-1 text-sm text-slate-600">Nous récupérons la conversation.</p>
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="lg:hidden -ml-2 p-2 text-[var(--dogshift-blue)] transition hover:text-[var(--dogshift-blue-hover)]"
                        aria-label="Retour aux conversations"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
                        {threadHeader.sitter.avatarUrl && avatarIsSafe(threadHeader.sitter.avatarUrl) ? (
                          <Image
                            src={threadHeader.sitter.avatarUrl}
                            alt={threadHeader.sitter.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">
                            {initialForName(threadHeader.sitter.name)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{threadHeader.sitter.name}</p>
                        {threadHeader.bookingId ? (
                          <p className="mt-0.5 truncate text-xs text-slate-500">Réservation: {threadHeader.bookingId}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col p-5">
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                      {messages.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm text-slate-600">Aucun message pour l’instant.</p>
                        </div>
                      ) : (
                        messages.map((m) => {
                          const mine = Boolean(viewerId && m.senderId === viewerId);
                          return (
                            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                              <div
                                className={
                                  mine
                                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--dogshift-blue)] px-4 py-2.5 text-white shadow-sm"
                                    : "max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-slate-900 shadow-sm"
                                }
                              >
                                <p className={`whitespace-pre-wrap text-[15px] ${mine ? "text-white" : "text-slate-900"}`}>{m.body}</p>
                                <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-slate-500"}`}>{formatDateTime(m.createdAt)}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="flex items-end gap-3">
                        <textarea
                          id="reply"
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          className="block w-full min-h-[44px] max-h-32 resize-none overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] text-slate-900 outline-none transition focus:border-[var(--dogshift-blue)] focus:bg-white focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)] sm:text-sm"
                          placeholder="Message"
                          rows={1}
                        />
                        <button
                          type="button"
                          disabled={!canSend}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void send();
                          }}
                          className="mb-[2px] flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dogshift-blue)] text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Envoyer"
                        >
                          {sending ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
