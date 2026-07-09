"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Maximize2 } from "lucide-react";

type Msg = { id: string; senderId: string; body: string; createdAt: string; readAt: string | null };

function initialForName(name: string) {
  const cleaned = (name ?? "").trim();
  return cleaned ? cleaned.slice(0, 1).toUpperCase() : "?";
}

function formatTime(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("fr-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(dt);
}

/**
 * In-popup conversation over the native map home. Opened from a sitter fiche's
 * "Contacter" — starts (or reuses) the owner↔sitter conversation and renders the
 * chat without leaving the map. A "plein écran" button jumps to the full
 * /account/messages thread. Founder: "chat en pop up sur la carte et un bouton
 * ouvrir en plein écran en haut à droite".
 */
export default function NativeConversationSheet({
  sitterId,
  sitterName,
  sitterAvatarUrl,
  onClose,
}: {
  sitterId: string;
  sitterName: string;
  sitterAvatarUrl: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Start (or reuse) the conversation, then load its thread.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/account/messages/conversations/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sitterId }),
        });
        if (res.status === 401) {
          router.push("/login?next=/account/messages");
          return;
        }
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; conversationId?: string } | null;
        if (!res.ok || !payload?.ok || !payload.conversationId) {
          if (!cancelled) setError("Impossible d'ouvrir la conversation.");
          return;
        }
        const cid = payload.conversationId;
        if (cancelled) return;
        setConversationId(cid);
        const tRes = await fetch(`/api/account/messages/conversations/${encodeURIComponent(cid)}`, { method: "GET" });
        const tPayload = (await tRes.json().catch(() => null)) as { ok?: boolean; viewerId?: string; messages?: Msg[] } | null;
        if (cancelled) return;
        if (tRes.ok && tPayload?.ok) {
          setMessages(Array.isArray(tPayload.messages) ? tPayload.messages : []);
          setViewerId(typeof tPayload.viewerId === "string" && tPayload.viewerId.trim() ? tPayload.viewerId.trim() : null);
        }
      } catch {
        if (!cancelled) setError("Impossible d'ouvrir la conversation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sitterId, router]);

  // Keyboard height (Capacitor resize:"none" → track it ourselves).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboardHeight(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    onResize();
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, keyboardHeight]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || !conversationId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/account/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; message?: Msg } | null;
      if (res.ok && payload?.ok && payload.message) {
        setText("");
        setMessages((prev) => [...prev, payload.message!]);
      }
    } finally {
      setSending(false);
    }
  }, [text, conversationId, sending]);

  const openFullScreen = useCallback(() => {
    router.push(conversationId ? `/account/messages?conversationId=${encodeURIComponent(conversationId)}` : "/account/messages");
  }, [conversationId, router]);

  const canSend = text.trim().length > 0 && !sending && Boolean(conversationId);

  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onClose} className="fixed inset-0 z-[1010] bg-black/30" />
      <div
        className="fixed left-2 right-2 z-[1020] flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(2,6,23,0.30)]"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          bottom:
            keyboardHeight > 0
              ? `calc(${keyboardHeight}px + 8px)`
              : "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 12px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              style={{ touchAction: "manipulation" }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-100">
              {sitterAvatarUrl ? (
                <img src={sitterAvatarUrl} alt={sitterName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">{initialForName(sitterName)}</div>
              )}
            </div>
            <p className="truncate text-sm font-semibold text-slate-900">{sitterName}</p>
          </div>
          <button
            type="button"
            onClick={openFullScreen}
            aria-label="Ouvrir en plein écran"
            style={{ touchAction: "manipulation" }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex min-h-[40%] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-900">{error}</div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Écris ton premier message à {sitterName}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const mine = Boolean(viewerId && m.senderId === viewerId);
                return (
                  <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        mine
                          ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[#7c3aed] px-4 py-2.5 shadow-sm"
                          : "max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 shadow-sm"
                      }
                    >
                      <p className={`whitespace-pre-wrap text-[15px] ${mine ? "text-white" : "text-slate-900"}`}>{m.body}</p>
                      <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-slate-500"}`}>{formatTime(m.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-3 py-2.5">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              placeholder="Message"
              className="block max-h-28 min-h-[44px] w-full resize-none overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] text-slate-900 outline-none transition focus:border-[#7c3aed] focus:bg-white focus:ring-4 focus:ring-[#7c3aed]/15"
            />
            <button
              type="button"
              disabled={!canSend}
              onClick={(e) => {
                e.preventDefault();
                void send();
              }}
              aria-label="Envoyer"
              style={{ touchAction: "manipulation" }}
              className="mb-[2px] flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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
    </>
  );
}
