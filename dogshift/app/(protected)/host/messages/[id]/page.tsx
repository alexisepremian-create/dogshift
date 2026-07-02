"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { X } from "lucide-react";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";

type SelectedDog = {
  id: string;
  name: string;
  breed: string | null;
  birthYear: number | null;
  weightKg: number | null;
  medications: string | null;
  allergies: string | null;
  vetContact: string | null;
  behaviorNotes: string | null;
  feedingNotes: string | null;
  sitterInstructions: string | null;
  photoUrl: string | null;
};

type ConversationHeader = {
  id: string;
  owner: { id: string; name: string; avatarUrl: string | null };
  bookingId: string | null;
  selectedDog: SelectedDog | null;
};

type MessageItem = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

const DOG_COLORS = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500"];
function dogColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return DOG_COLORS[h % DOG_COLORS.length];
}

function initialForName(name: string) {
  return (name ?? "").trim().slice(0, 1).toUpperCase() || "?";
}

function DogAvatar({ dog, size = 28 }: { dog: SelectedDog; size?: number }) {
  const src = dog.photoUrl ? publicDogPhotoPath(dog.photoUrl) : null;
  if (src) {
    return (
      <div className="relative shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
        <Image src={src} alt={dog.name} fill className="object-cover" sizes={`${size}px`} />
      </div>
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-white font-semibold ${dogColor(dog.id)}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initialForName(dog.name)}
    </div>
  );
}

function formatDateTime(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("fr-CH", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(dt);
}

export default function HostMessageThreadPage() {
  const params = useParams<{ id: string }>();
  const conversationId = typeof params?.id === "string" ? params.id : "";

  const [header, setHeader] = useState<ConversationHeader | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [dogProfileOpen, setDogProfileOpen] = useState(false);

  async function loadThread() {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/host/messages/conversations/${encodeURIComponent(conversationId)}`, { method: "GET" });
      const payload = (await res.json()) as {
        ok?: boolean;
        viewerId?: string;
        conversation?: ConversationHeader;
        messages?: MessageItem[];
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.conversation) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") setError("Connexion requise (401).");
        else if (res.status === 403 || payload.error === "FORBIDDEN") setError("Accès refusé (403).");
        else if (res.status === 404 || payload.error === "NOT_FOUND") setError("Introuvable (404).");
        else setError("Conversation introuvable.");
        setHeader(null); setMessages([]); setViewerId(null);
        return;
      }
      setHeader(payload.conversation);
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setViewerId(typeof payload.viewerId === "string" && payload.viewerId.trim() ? payload.viewerId.trim() : null);
    } catch {
      setError("Impossible de charger la conversation.");
      setHeader(null); setMessages([]); setViewerId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!conversationId) return;
    void loadThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const canSend = text.trim().length > 0 && !sending;

  async function send() {
    if (!conversationId) return;
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/host/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const payload = (await res.json()) as { ok?: boolean; message?: MessageItem; error?: string };
      if (!res.ok || !payload.ok || !payload.message) {
        if (res.status === 401 || payload.error === "UNAUTHORIZED") { setError("Connexion requise (401)."); return; }
        setError(`Impossible d'envoyer le message (${payload.error ?? res.status}).`);
        return;
      }
      setText("");
      setError(null);
      setMessages((prev) => [...prev, payload.message!]);
    } catch {
      setError("Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  }

  if (error && !header) {
    return (
      <div className="ds-card rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
        <p className="text-sm font-semibold text-slate-900">{error}</p>
        <div className="mt-5">
          <Link href="/login" className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const dog = header?.selectedDog ?? null;

  return (
    <div className="flex h-full flex-col">
      {loading || !header ? (
        <div className="ds-card rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold text-slate-900">Chargement…</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/host/messages"
                className="lg:hidden -ml-2 p-2 text-[var(--dogshift-blue)] transition hover:text-[var(--dogshift-blue-hover)]"
                aria-label="Retour"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{header.owner.name}</p>
              </div>
            </div>

            {/* Dog badge — click to open full profile */}
            {dog && (
              <button
                type="button"
                onClick={() => setDogProfileOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-[var(--dogshift-blue)]/20 bg-[color-mix(in_srgb,var(--dogshift-blue),white_93%)] px-3 py-1.5 text-xs font-semibold text-[var(--dogshift-blue)] transition hover:bg-[color-mix(in_srgb,var(--dogshift-blue),white_85%)]"
              >
                <DogAvatar dog={dog} size={20} />
                <span>{dog.name}</span>
                {dog.breed && <span className="opacity-70 hidden sm:inline">· {dog.breed}</span>}
                <span className="ml-0.5 text-[10px] opacity-60">Fiche ›</span>
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex min-h-0 flex-1 flex-col p-6">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Aucun message pour l&apos;instant.</p>
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
                  onClick={() => void send()}
                  className="mb-[2px] flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dogshift-blue)] text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* Full dog profile modal (sitter view) */}
      {dogProfileOpen && dog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setDogProfileOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <DogAvatar dog={dog} size={56} />
                <div>
                  <p className="text-base font-bold text-slate-900">{dog.name}</p>
                  <p className="text-sm text-slate-500">
                    {[dog.breed, dog.birthYear ? `né en ${dog.birthYear}` : null, dog.weightKg ? `${dog.weightKg} kg` : null]
                      .filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setDogProfileOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-sm">
              {dog.allergies && (
                <div><span className="font-semibold text-slate-700">Allergies : </span><span className="text-slate-600">{dog.allergies}</span></div>
              )}
              {dog.medications && (
                <div><span className="font-semibold text-slate-700">Médicaments : </span><span className="text-slate-600">{dog.medications}</span></div>
              )}
              {dog.behaviorNotes && (
                <div><span className="font-semibold text-slate-700">Comportement : </span><span className="text-slate-600">{dog.behaviorNotes}</span></div>
              )}
              {dog.feedingNotes && (
                <div><span className="font-semibold text-slate-700">Alimentation : </span><span className="text-slate-600">{dog.feedingNotes}</span></div>
              )}
              {dog.vetContact && (
                <div><span className="font-semibold text-slate-700">Vétérinaire : </span><span className="text-slate-600">{dog.vetContact}</span></div>
              )}
              {dog.sitterInstructions && (
                <div className="rounded-2xl bg-amber-50 p-3 mt-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Instructions du propriétaire</p>
                  <p className="text-slate-700">{dog.sitterInstructions}</p>
                </div>
              )}
              {!dog.allergies && !dog.medications && !dog.behaviorNotes && !dog.feedingNotes && !dog.vetContact && !dog.sitterInstructions && (
                <p className="text-slate-500 italic">Aucune information supplémentaire renseignée.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
