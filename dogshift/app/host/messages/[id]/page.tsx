"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

type ConversationHeader = {
  id: string;
  owner: { id: string; name: string; avatarUrl: string | null };
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

export default function HostMessageThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const conversationId = typeof params?.id === "string" ? params.id : "";

  const [header, setHeader] = useState<ConversationHeader | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
    }
  }, [isLoaded, isSignedIn, router]);

  async function loadThread() {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/host/messages/conversations/${encodeURIComponent(conversationId)}`, { method: "GET" });
      const payload = (await res.json()) as {
        ok?: boolean;
        conversation?: ConversationHeader;
        messages?: MessageItem[];
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.conversation) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") {
          setError("Connexion requise (401). ");
          return;
        }
        if (res.status === 403 || payload.error === "FORBIDDEN") {
          setError("Accès refusé (403).");
        } else if (res.status === 404 || payload.error === "NOT_FOUND") {
          setError("Introuvable (404).");
        } else if (res.status >= 500) {
          setError("Erreur serveur (500). ");
        } else {
          setError("Conversation introuvable.");
        }
        setHeader(null);
        setMessages([]);
        return;
      }
      setHeader(payload.conversation);
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    } catch {
      setError("Impossible de charger la conversation.");
      setHeader(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, isLoaded, isSignedIn]);

  const canSend = text.trim().length > 0 && !sending;

  const threadTitle = useMemo(() => header?.owner?.name ?? "Conversation", [header]);

  async function send() {
    if (!conversationId) return;
    const body = text.trim();
    if (!body) return;
    if (sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/host/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const payload = (await res.json()) as { ok?: boolean; message?: MessageItem; error?: string };
      if (!res.ok || !payload.ok || !payload.message) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") {
          setError("Connexion requise (401). ");
          return;
        }
        setError(`Impossible d’envoyer le message (${payload.error ?? res.status}).`);
        return;
      }
      setText("");
      setError(null);
      setMessages((prev) => [...prev, payload.message!]);
    } catch {
      setError("Impossible d’envoyer le message.");
    } finally {
      setSending(false);
    }
  }

  if (!isLoaded) return null;
  if (!isSignedIn) return null;

  if (error) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
        <p className="text-sm font-semibold text-slate-900">Connexion requise (401).</p>
        <p className="mt-2 text-sm text-slate-600">Connecte-toi pour accéder à cette conversation.</p>
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
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-600">Messages</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{threadTitle}</h1>
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
              onClick={() => void loadThread()}
              className="mt-4 inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50"
            >
              Réessayer
            </button>
          )}
        </div>
      ) : null}

      {loading || !header ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold text-slate-900">Chargement…</p>
          <p className="mt-2 text-sm text-slate-600">Nous récupérons la conversation.</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-2xl bg-slate-100">
                {header.owner.avatarUrl && avatarIsSafe(header.owner.avatarUrl) ? (
                  <Image src={header.owner.avatarUrl} alt={header.owner.name} fill className="object-cover" sizes="40px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">
                    {initialForName(header.owner.name)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{header.owner.name}</p>
                {header.bookingId ? <p className="mt-0.5 text-xs text-slate-500 truncate">Réservation: {header.bookingId}</p> : null}
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Aucun message pour l’instant.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = false;
                  return (
                    <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={
                          mine
                            ? "max-w-[85%] rounded-2xl border border-slate-200 bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] px-4 py-3"
                            : "max-w-[85%] rounded-2xl border border-slate-200 bg-white px-4 py-3"
                        }
                      >
                        <p className="whitespace-pre-line text-sm text-slate-800">{m.body}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatDateTime(m.createdAt)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <label htmlFor="reply" className="block text-sm font-medium text-slate-700">
                Message
              </label>
              <textarea
                id="reply"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="mt-2 w-full min-h-[110px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                placeholder="Écrire un message…"
              />
              <button
                type="button"
                disabled={!canSend}
                onClick={() => void send()}
                className="mt-3 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
