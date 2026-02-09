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

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function scoreMatch(input: string, keywords: string[]) {
  const hay = normalize(input);
  let score = 0;
  for (const k of keywords) {
    if (hay.includes(normalize(k))) score += 1;
  }
  return score;
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
  const faq = useMemo(
    () =>
      [
        {
          keywords: [
            "promenade",
            "balade",
            "sortie",
            "promener",
            "durée",
            "duree",
            "heure",
            "heures",
          ],
          answer:
            "Promenade : un sitter vient promener votre chien (durée et fréquence selon l'annonce). Idéal pour les journées chargées.",
        },
        {
          keywords: ["garde", "visite", "à domicile", "a domicile", "passage", "check"],
          answer:
            "Garde / visite à domicile : le sitter passe chez vous pour nourrir, sortir et s'occuper de votre chien, sans hébergement.",
        },
        {
          keywords: ["pension", "hebergement", "hébergement", "nuit", "nuits", "chez le sitter"],
          answer:
            "Pension (hébergement) : votre chien est accueilli chez le sitter (souvent avec une routine familiale).",
        },
        {
          keywords: ["prix", "tarif", "tarifs", "combien", "coût", "cout", "paiement", "payer"],
          answer:
            "Les tarifs dépendent du service, de la durée et du sitter. Sur DogShift, vous comparez facilement les profils et leurs prix avant de réserver.",
        },
        {
          keywords: ["reservation", "réservation", "reserver", "réserver", "disponible", "disponibilite"],
          answer:
            "Pour réserver : choisissez un service + une ville, comparez les profils, puis contactez/réservez le sitter qui correspond à vos besoins.",
        },
        {
          keywords: ["annulation", "annuler", "modifier", "changement", "report"],
          answer:
            "Annulation / modification : cela dépend des conditions du sitter et du service. Si vous me dites votre cas (service + date), je vous guide.",
        },
        {
          keywords: ["securite", "sécurité", "assurance", "confiance", "avis", "verification"],
          answer:
            "Sécurité : consultez les avis, l'expérience, et échangez avec le sitter avant la garde. Choisissez un profil vérifié quand disponible.",
        },
        {
          keywords: ["devenir", "dogsitter", "sitter", "inscription", "rejoindre"],
          answer:
            "Devenir dogsitter : vous pouvez vous inscrire et créer votre profil. Ensuite, vous proposez vos services et recevez des demandes.",
        },
        {
          keywords: ["contact", "support", "aide", "bug", "probleme", "problème"],
          answer:
            "Besoin d'aide ? Dites-moi ce qui bloque (page, action, message d'erreur) et je vous aide à trouver la bonne marche à suivre.",
        },
      ] as const,
    []
  );

  const initialBotMessage: ChatMessage = useMemo(
    () => ({
      id: nowId(),
      role: "bot",
      text:
        "Bonjour, je suis DogShift Bot. Posez-moi vos questions sur les services (Promenade, Garde, Pension), la réservation, ou les tarifs.",
      ts: Date.now(),
    }),
    []
  );

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([initialBotMessage]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages }));
    } catch {
      // ignore
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

  function getBotReply(userText: string) {
    const scored = faq
      .map((item) => ({ item, score: scoreMatch(userText, [...item.keywords]) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0]?.score > 0) return scored[0].item.answer;

    return (
      "Je peux vous aider sur : Promenade, Garde, Pension, réservation, tarifs, sécurité. " +
      "Dites-moi ce que vous cherchez (service + ville) et je vous guide."
    );
  }

  function send() {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: nowId(), role: "user", text, ts: Date.now() };
    const botMsg: ChatMessage = {
      id: nowId(),
      role: "bot",
      text: getBotReply(text),
      ts: Date.now() + 1,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 hidden md:block">
      {open ? (
        <div className="w-[360px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_24px_80px_-50px_rgba(2,6,23,0.65)] backdrop-blur-xl">
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

          <div ref={scrollRef} className="max-h-[380px] overflow-auto px-4 py-3">
            <div className="flex flex-col gap-2">
              {messages.map((m) => {
                const isUser = m.role === "user";
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
                      {m.text}
                    </div>
                  </div>
                );
              })}
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
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
                aria-label="Message pour DogShift Bot"
              />
              <button
                type="button"
                onClick={send}
                className="grid h-9 w-9 flex-none place-items-center rounded-2xl bg-[var(--dogshift-blue)] text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group mt-3 inline-flex h-14 items-center gap-3 rounded-3xl bg-[var(--dogshift-blue)] pl-4 pr-5 text-white shadow-[0_18px_60px_-40px_rgba(2,6,23,0.75)] ring-1 ring-white/15 transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
          aria-label="Ouvrir DogShift Bot"
        >
          <DogRobotIcon className="h-7 w-7 text-white transition group-hover:scale-[1.03]" />
          <span className="hidden select-none text-xs font-semibold text-white sm:inline">
            Posez-moi une question
          </span>
        </button>
      ) : null}
    </div>
  );
}
