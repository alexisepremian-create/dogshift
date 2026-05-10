"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, X } from "lucide-react";

type Role = "user" | "bot";

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  ts: number;
};

const STORAGE_KEY = "dogshift:bot:v1";
const BTN_SIZE = 56; // taille du bouton draggable en px

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function DogRobotIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8.6 6.1 6.3 4.6c-.5-.3-1.1-.1-1.4.4-.2.4-.2.9.1 1.3l1.7 2.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.4 6.1 17.7 4.6c.5-.3 1.1-.1 1.4.4.2.4.2.9-.1 1.3l-1.7 2.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3v1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M12 5.2c-3.7 0-6.7 2.9-6.7 6.6v2.2c0 3.7 3 6.6 6.7 6.6s6.7-2.9 6.7-6.6v-2.2c0-3.7-3-6.6-6.7-6.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.2h.2M14.6 12.2h.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.1 14.9c.9.7 2.9.7 3.8 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M7.4 9.5h9.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".55"
      />
    </svg>
  );
}

export default function DogShiftBot() {
  const initialBotMessage: ChatMessage = useMemo(
    () => ({
      id: nowId(),
      role: "bot",
      text:
        "Bonjour ! Je suis DogShift Bot 🐾 Je peux répondre à vos questions sur nos services (Promenade, Garde, Pension), la réservation, les tarifs, la sécurité, devenir sitter… Posez-moi n'importe quelle question !",
      ts: Date.now(),
    }),
    []
  );

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([initialBotMessage]);
  const [dismissed, setDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Tracks emails already captured to avoid duplicate lead-magnet calls
  const capturedEmails = useRef<Set<string>>(new Set());

  // ── Snap aux 4 coins (mobile : drag touch avec suivi visuel) ──────────────
  type Corner = "br" | "bl" | "tr" | "tl";
  const [corner, setCorner] = useState<Corner>("br");
  const [livePos, setLivePos] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dragBtnRef = useRef<HTMLButtonElement | null>(null);
  const dragState = useRef({ active: false, moved: false, startTX: 0, startTY: 0 });
  const justDragged = useRef(false);

  // touchmove non-passif : suit le doigt en temps réel
  useEffect(() => {
    const btn = dragBtnRef.current;
    if (!btn) return;
    const onMove = (e: TouchEvent) => {
      if (!dragState.current.active) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - dragState.current.startTX, t.clientY - dragState.current.startTY) < 8) return;
      dragState.current.moved = true;
      e.preventDefault();
      // Clamp pour garder le bouton dans l'écran
      const x = Math.max(0, Math.min(window.innerWidth - BTN_SIZE, t.clientX - BTN_SIZE / 2));
      const y = Math.max(0, Math.min(window.innerHeight - BTN_SIZE, t.clientY - BTN_SIZE / 2));
      setLivePos({ x, y });
    };
    btn.addEventListener("touchmove", onMove, { passive: false });
    return () => btn.removeEventListener("touchmove", onMove);
  }, [open]); // re-attache quand le bouton réapparaît après fermeture du panneau

  function onTouchStart(e: React.TouchEvent<HTMLButtonElement>) {
    if (open) return;
    const t = e.touches[0];
    dragState.current = { active: true, moved: false, startTX: t.clientX, startTY: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent<HTMLButtonElement>) {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    setLivePos(null); // retire la position live → le corner prend le relais
    if (dragState.current.moved) {
      justDragged.current = true;
      // Snap au coin le plus proche de l'endroit où le doigt est relâché
      const t = e.changedTouches[0];
      const mX = window.innerWidth / 2;
      const mY = window.innerHeight / 2;
      setCorner(`${t.clientY < mY ? "t" : "b"}${t.clientX < mX ? "l" : "r"}` as Corner);
    }
    dragState.current.moved = false;
  }

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { messages?: ChatMessage[] };
      if (parsed?.messages?.length) setMessages(parsed.messages);
    } catch {
      // ignore
    }
  }, []);

  // Persist history to localStorage on every change
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages }));
    } catch {
      // ignore
    }
  }, [messages]);

  // Lead magnet interception — detect LEADMAGNET:[email] in bot messages and
  // silently call the lead-magnet agent. Runs on render (messages change).
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "bot") continue;
      const match = /^LEADMAGNET:(.+)$/m.exec(msg.text);
      if (!match) continue;
      const email = match[1].trim();
      if (capturedEmails.current.has(email)) continue;
      capturedEmails.current.add(email);
      fetch("/api/agents/lead-magnet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "chatbot" }),
      }).catch(() => {});
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: nowId(), role: "user", text, ts: Date.now() };
    const botId = nowId();
    const botMsg: ChatMessage = { id: botId, role: "bot", text: "", ts: Date.now() + 1 };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Convert internal 'bot' role to 'assistant' and strip any LEADMAGNET lines
      // from history before sending to the API
      const apiMessages = [...messages, userMsg]
        .filter((m) => m.text.trim())
        .map((m) => ({
          role: m.role === "bot" ? ("assistant" as const) : ("user" as const),
          content: m.text.replace(/^LEADMAGNET:.+$/m, "").trim(),
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      if (!response.body) throw new Error("Pas de réponse");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, text: accumulated } : m))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Streaming error"));
      // Remove the empty bot placeholder so it doesn't render as blank
      setMessages((prev) => prev.filter((m) => m.id !== botId || m.text));
    } finally {
      setIsLoading(false);
    }
  }

  if (dismissed) return null;

  // Position selon le coin actif (ou position live pendant le drag)
  const isRight = corner.endsWith("r");
  const isBottom = corner.startsWith("b");
  const cornerStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 50,
    ...(isRight ? { right: 16 } : { left: 16 }),
    ...(isBottom ? { bottom: 80 } : { top: 72 }),
  };
  const wrapStyle: React.CSSProperties = livePos
    ? { position: "fixed", top: livePos.y, left: livePos.x, right: "auto", bottom: "auto", zIndex: 50, opacity: 0.85 }
    : cornerStyle;

  // Panneau : s'ouvre vers le haut si coin bas, vers le bas si coin haut
  const colDir = isBottom ? "flex-col" : "flex-col-reverse";
  const alignItems = isRight ? "items-end" : "items-start";

  return (
    <div ref={wrapRef} style={wrapStyle} className={`flex gap-3 ${colDir} ${alignItems}`}>
      {open ? (
        <div className="w-[360px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_-50px_rgba(2,6,23,0.65)]">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--dogshift-blue)] shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_65%)] ring-1 ring-white/15">
                <DogRobotIcon className="h-5 w-5 text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">DogShift Bot</p>
                <p className="text-xs font-medium text-slate-500">Assistant virtuel</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-2xl text-slate-700 transition hover:bg-white/70 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              aria-label="Fermer DogShift Bot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-[340px] overflow-auto px-4 py-3">
            <div className="flex flex-col gap-2">
              {messages.map((m) => {
                const isUser = m.role === "user";
                // Strip LEADMAGNET tag before display; show "..." while streaming starts
                const rawText = isUser
                  ? m.text
                  : m.text.replace(/^LEADMAGNET:.+$/m, "").trim();
                const displayText = rawText || (isLoading ? "..." : null);
                if (!displayText) return null;
                return (
                  <div
                    key={m.id}
                    className={isUser ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        isUser
                          ? "max-w-[85%] rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2 text-sm font-medium text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)]"
                          : "max-w-[85%] rounded-2xl bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200/60"
                      }
                    >
                      {displayText}
                    </div>
                  </div>
                );
              })}
              {error && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200/60">
                    Désolé, une erreur est survenue. Réessayez dans un instant 🐾
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200/70 p-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-slate-200/60">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Posez votre question…"
                disabled={isLoading}
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
                aria-label="Message pour DogShift Bot"
              />
              <button
                type="button"
                onClick={send}
                disabled={isLoading}
                className="grid h-9 w-9 flex-none place-items-center rounded-2xl bg-[var(--dogshift-blue)] text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bouton flottant */}
      {!open ? (
        <div className="relative">
          {/* Croix dismiss (petit badge) */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute -top-1.5 -left-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-white shadow ring-2 ring-white transition hover:bg-slate-900"
            aria-label="Masquer DogShift Bot"
          >
            <X className="h-2.5 w-2.5" />
          </button>

          {/* Bouton principal — draggable */}
          <button
            ref={dragBtnRef}
            type="button"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onClick={() => {
              if (justDragged.current) { justDragged.current = false; return; }
              setOpen(true);
            }}
            style={{ userSelect: "none" }}
            className="group grid h-14 w-14 place-items-center rounded-full bg-[var(--dogshift-blue)] text-white shadow-[0_18px_60px_-40px_rgba(2,6,23,0.75)] ring-1 ring-white/15 transition hover:bg-[var(--dogshift-blue-hover)] md:inline-flex md:h-14 md:w-auto md:items-center md:gap-3 md:rounded-3xl md:pl-4 md:pr-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            aria-label="Ouvrir DogShift Bot"
          >
            <DogRobotIcon className="h-7 w-7 text-white transition group-hover:scale-[1.03]" />
            <span className="hidden select-none text-xs font-semibold text-white md:inline">
              Posez-moi une question
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
