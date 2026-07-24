"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";

import { ageLabel, type MatchSummary } from "./types";

type ChatMessage = { id: string; body: string; mine: boolean; createdAt: string };

function MatchChat({ match, onBack }: { match: MatchSummary; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/breeding/matches/${match.matchId}/messages`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; messages?: ChatMessage[] } | null;
      if (data?.ok && Array.isArray(data.messages)) setMessages(data.messages);
    } catch {
      /* ignore */
    }
  }, [match.matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch(`/api/breeding/matches/${match.matchId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: ChatMessage } | null;
      if (data?.ok && data.message) setMessages((prev) => [...prev, data.message as ChatMessage]);
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-3 py-2">
        <button type="button" onClick={onBack} aria-label="Retour" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 active:bg-slate-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {match.otherDog.photoUrl ? (
          <img src={match.otherDog.photoUrl} alt={match.otherDog.dogName} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7c3aed]/15 text-sm">🐶</div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{match.otherDog.dogName}</p>
          <p className="truncate text-xs text-slate-500">{match.otherDog.breed ?? ""}</p>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Dites-vous bonjour 👋</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? "bg-[#7c3aed] text-white" : "bg-slate-100 text-slate-900"}`}>{m.body}</div>
            </div>
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 px-3 py-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          placeholder="Écris un message…"
          className="flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-base text-slate-900 outline-none"
        />
        <button type="button" onClick={() => void send()} disabled={sending || !text.trim()} aria-label="Envoyer" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#7c3aed] text-white active:scale-95 disabled:opacity-40">
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export default function MatchesTab() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<MatchSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/breeding/matches", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; matches?: MatchSummary[] } | null;
        if (!cancelled) setMatches(data?.ok && Array.isArray(data.matches) ? data.matches : []);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (open) return <MatchChat match={open} onBack={() => setOpen(null)} />;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-5xl">💜</div>
        <p className="text-base font-semibold text-slate-900">Pas encore de match</p>
        <p className="text-sm text-slate-500">Swipe à droite les chiens qui te plaisent. Quand c&apos;est réciproque, vous matchez et pouvez discuter ici.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-2">
      <div className="space-y-2">
        {matches.map((m) => (
          <button key={m.matchId} type="button" onClick={() => setOpen(m)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-left active:bg-slate-50">
            {m.otherDog.photoUrl ? (
              <img src={m.otherDog.photoUrl} alt={m.otherDog.dogName} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7c3aed]/15 text-lg">🐶</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900">
                {m.otherDog.dogName}
                {ageLabel(m.otherDog.birthYear) ? <span className="ml-1 text-sm font-normal text-slate-400">· {ageLabel(m.otherDog.birthYear)}</span> : null}
              </p>
              <p className="truncate text-sm text-slate-500">{m.lastMessagePreview ?? m.otherDog.breed ?? "Nouveau match"}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
