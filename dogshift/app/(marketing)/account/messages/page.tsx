"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Archive, ChevronDown, Dog, MessageCircle, Pin, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";

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
  sitter: { sitterId: string; name: string; avatarUrl: string | null };
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

type DogPickerItem = { id: string; name: string; breed: string | null; photoUrl: string | null };

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

const DOG_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-indigo-500",
];
function dogColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return DOG_COLORS[h % DOG_COLORS.length];
}

function DogAvatar({ dog, size = 28 }: { dog: { id: string; name: string; photoUrl?: string | null }; size?: number }) {
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

// ── Swipeable row component (reveal actions on left-swipe, like iMessage) ─────
function SwipeableRow({
  children,
  onPin,
  onArchive,
  onDelete,
}: {
  children: React.ReactNode;
  onPin?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const SNAP_THRESHOLD = 60; // px to reveal actions
  const ACTION_WIDTH = 168; // total width of 3 actions (3 × 56px)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (isHorizontal.current === null) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHorizontal.current) return;
    e.preventDefault();
    const raw = Math.min(0, dx); // only allow left swipe
    setOffset(Math.max(-ACTION_WIDTH, raw));
  }

  function onTouchEnd() {
    setDragging(false);
    isHorizontal.current = null;
    setOffset((prev) => (prev < -SNAP_THRESHOLD ? -ACTION_WIDTH : 0));
  }

  function close() { setOffset(0); }

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons revealed behind the row */}
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: ACTION_WIDTH }}
        aria-hidden={offset === 0}
      >
        <button
          type="button"
          onClick={() => { onPin?.(); close(); }}
          className="flex w-14 flex-col items-center justify-center gap-1 bg-slate-500 text-white text-[10px] font-semibold"
          aria-label="Épingler"
        >
          <Pin className="h-4 w-4" />
          <span>Épingler</span>
        </button>
        <button
          type="button"
          onClick={() => { onArchive?.(); close(); }}
          className="flex w-14 flex-col items-center justify-center gap-1 bg-[var(--dogshift-blue)] text-white text-[10px] font-semibold"
          aria-label="Archiver"
        >
          <Archive className="h-4 w-4" />
          <span>Archiver</span>
        </button>
        <button
          type="button"
          onClick={() => { onDelete?.(); close(); }}
          className="flex w-14 flex-col items-center justify-center gap-1 bg-rose-600 text-white text-[10px] font-semibold"
          aria-label="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
          <span>Supprimer</span>
        </button>
      </div>

      {/* Main content — slides left on swipe */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function AccountMessagesPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadHeader, setThreadHeader] = useState<ConversationHeader | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // Dog selector state
  const [dogs, setDogs] = useState<DogPickerItem[]>([]);
  const [dogPickerOpen, setDogPickerOpen] = useState(false);
  const [settingDog, setSettingDog] = useState(false);
  const [dogProfileOpen, setDogProfileOpen] = useState(false);
  const dogPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
    }
  }, [isLoaded, isSignedIn, router]);

  // Close dog picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dogPickerRef.current && !dogPickerRef.current.contains(e.target as Node)) {
        setDogPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  async function loadDogs() {
    try {
      const res = await fetch("/api/account/dogs");
      const data = (await res.json()) as { dogs?: DogPickerItem[] };
      setDogs(data.dogs ?? []);
    } catch {
      setDogs([]);
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

  async function selectDog(dogId: string | null) {
    if (!selectedId) return;
    setSettingDog(true);
    setDogPickerOpen(false);
    try {
      const res = await fetch(`/api/account/messages/conversations/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dogProfileId: dogId }),
      });
      const data = (await res.json()) as { ok?: boolean; selectedDog?: SelectedDog | null };
      if (res.ok && data.ok) {
        setThreadHeader((prev) => prev ? { ...prev, selectedDog: data.selectedDog ?? null } : prev);
      }
    } finally {
      setSettingDog(false);
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
    void loadDogs();
     
  }, [isLoaded, isSignedIn]);

  const rows = useMemo(() => {
    return conversations
      .filter((c) => !archivedIds.has(c.id))
      .slice()
      .sort((a, b) => {
        const pinA = pinnedIds.has(a.id) ? 1 : 0;
        const pinB = pinnedIds.has(b.id) ? 1 : 0;
        if (pinB !== pinA) return pinB - pinA;
        const ta = new Date(a.lastMessageAt ?? a.updatedAt).getTime();
        const tb = new Date(b.lastMessageAt ?? b.updatedAt).getTime();
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
      });
  }, [conversations, pinnedIds, archivedIds]);

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
        setThreadError(`Impossible d'envoyer le message (${payload.error ?? res.status}).`);
        return;
      }
      setText("");
      setMessages((prev) => [...prev, payload.message!]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, lastMessageAt: payload.message!.createdAt, lastMessagePreview: payload.message!.body }
            : c
        )
      );
    } finally {
      setSending(false);
    }
  }

  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
        <p className="text-sm font-semibold text-slate-900">Connexion requise (401).</p>
        <Link href="/login" className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]">
          Se connecter
        </Link>
      </div>
    );
  }

  const selectedDog = threadHeader?.selectedDog ?? null;

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col bg-white -mx-4 -mt-4 sm:mx-0 sm:mt-0 sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]" data-testid="account-messages-page">
      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-900 sm:p-8">
          <p>{error}</p>
          {error.includes("401") ? (
            <Link href="/login" className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]">
              Se connecter
            </Link>
          ) : (
            <button type="button" onClick={() => void loadConversations()} className="mt-4 inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50">
              Réessayer
            </button>
          )}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold text-slate-900">Chargement…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
          <p className="text-sm font-semibold text-slate-900">Aucune conversation</p>
          <p className="mt-2 text-sm text-slate-600">Quand tu contactes un dogsitter, la conversation apparaîtra ici.</p>
          <div className="mt-5">
            <Link href="/search" className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]">
              Trouver un sitter
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative">
          <div className="grid h-full gap-0 lg:grid-cols-[360px_1fr]">
            {/* Conversation list */}
            <section
              className={
                "h-full flex-col p-4 sm:p-6 " +
                (selectedId ? "hidden lg:flex " : "flex ") +
                "lg:border-r lg:border-slate-200"
              }
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversations</span>
                <button type="button" onClick={() => void refreshAll()} className="rounded-lg p-1.5 text-slate-400 transition hover:text-slate-700" aria-label="Actualiser">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {rows.map((c) => {
                  const subtitle = c.booking?.service
                    ? `${c.booking.service} • ${c.booking.startDate ? formatDateOnly(c.booking.startDate) : "—"}`
                    : "Conversation";
                  const active = c.id === selectedId;
                  const isPinned = pinnedIds.has(c.id);
                  return (
                    <SwipeableRow
                      key={c.id}
                      onPin={() => setPinnedIds((prev) => { const n = new Set(prev); if (isPinned) { n.delete(c.id); } else { n.add(c.id); } return n; })}
                      onArchive={() => setArchivedIds((prev) => { const n = new Set(prev); n.add(c.id); return n; })}
                      onDelete={() => setConversations((prev) => prev.filter((x) => x.id !== c.id))}
                    >
                      <button
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
                          "block w-full border-b border-slate-100 px-4 py-3 text-left transition " +
                          (active
                            ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_96%)]"
                            : "bg-white hover:bg-slate-50")
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
                              {isPinned && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-500 text-white">
                                  <Pin className="h-2.5 w-2.5" />
                                </span>
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
                    </SwipeableRow>
                  );
                })}
              </div>
            </section>

            {/* Thread */}
            <section className={"h-full min-h-0 flex-col p-0 lg:p-6 lg:border-l lg:border-t-0 " + (selectedId ? "flex" : "hidden lg:flex")}>
              {threadError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                  <p className="text-sm font-semibold text-rose-900">{threadError}</p>
                </div>
              ) : !selectedId ? (
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <MessageCircle className="h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-900">Sélectionne une conversation</p>
                  <p className="mt-1 text-sm text-slate-600">Clique sur une conversation à gauche pour l&apos;ouvrir.</p>
                </div>
              ) : threadLoading || !threadHeader ? (
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">Chargement…</p>
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col bg-white">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="lg:hidden -ml-2 p-2 text-[var(--dogshift-blue)] transition hover:text-[var(--dogshift-blue-hover)]"
                        aria-label="Retour"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
                        {threadHeader.sitter.avatarUrl && avatarIsSafe(threadHeader.sitter.avatarUrl) ? (
                          <Image src={threadHeader.sitter.avatarUrl} alt={threadHeader.sitter.name} fill className="object-cover" sizes="40px" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">
                            {initialForName(threadHeader.sitter.name)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{threadHeader.sitter.name}</p>
                      </div>
                    </div>

                    {/* Dog selector */}
                    <div className="flex items-center gap-2" ref={dogPickerRef}>
                      {selectedDog ? (
                        <button
                          type="button"
                          onClick={() => setDogProfileOpen(true)}
                          className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          <DogAvatar dog={selectedDog} size={20} />
                          <span className="max-w-[80px] truncate">{selectedDog.name}</span>
                        </button>
                      ) : null}

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setDogPickerOpen((o) => !o)}
                          disabled={settingDog}
                          className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          aria-label="Choisir un chien"
                        >
                          <Dog className="h-3.5 w-3.5" />
                          <ChevronDown className="h-3 w-3" />
                        </button>

                        {dogPickerOpen && (
                          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl">
                            {dogs.length === 0 ? (
                              <div className="px-3 py-2">
                                <p className="text-xs text-slate-500">Aucun chien enregistré.</p>
                                <Link href="/account/dogs" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--dogshift-blue)] hover:underline">
                                  <Plus className="h-3 w-3" />
                                  Ajouter un chien
                                </Link>
                              </div>
                            ) : (
                              <>
                                <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Chien concerné</p>
                                {dogs.map((dog) => (
                                  <button
                                    key={dog.id}
                                    type="button"
                                    onClick={() => void selectDog(dog.id)}
                                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${selectedDog?.id === dog.id ? "font-semibold text-[var(--dogshift-blue)]" : "text-slate-900"}`}
                                  >
                                    <DogAvatar dog={dog} size={24} />
                                    <span className="flex-1 truncate">{dog.name}</span>
                                    {selectedDog?.id === dog.id && <span className="text-[var(--dogshift-blue)]">✓</span>}
                                  </button>
                                ))}
                                {selectedDog && (
                                  <button
                                    type="button"
                                    onClick={() => void selectDog(null)}
                                    className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-50"
                                  >
                                    <X className="h-3 w-3" />
                                    Retirer le chien
                                  </button>
                                )}
                                <Link
                                  href="/account/dogs"
                                  className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-xs font-medium text-[var(--dogshift-blue)] hover:bg-slate-50"
                                >
                                  <Plus className="h-3 w-3" />
                                  Gérer mes chiens
                                </Link>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Messages — scrollable area */}
                  <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-2">
                    <div className="space-y-3">
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
                  </div>

                  {/* Input bar — always visible at bottom, above safe area */}
                  <div
                    className="shrink-0 border-t border-slate-100 bg-white px-4 py-3"
                    style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
                  >
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
                          void send();
                        }}
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
              )}
            </section>
          </div>
        </div>
      )}

      {/* Dog profile modal */}
      {dogProfileOpen && selectedDog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setDogProfileOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <DogAvatar dog={selectedDog} size={52} />
                <div>
                  <p className="text-base font-bold text-slate-900">{selectedDog.name}</p>
                  <p className="text-sm text-slate-500">
                    {[selectedDog.breed, selectedDog.birthYear ? `né en ${selectedDog.birthYear}` : null, selectedDog.weightKg ? `${selectedDog.weightKg} kg` : null]
                      .filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setDogProfileOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2.5 text-sm">
              {selectedDog.allergies && (
                <div><span className="font-semibold text-slate-700">Allergies : </span><span className="text-slate-600">{selectedDog.allergies}</span></div>
              )}
              {selectedDog.medications && (
                <div><span className="font-semibold text-slate-700">Médicaments : </span><span className="text-slate-600">{selectedDog.medications}</span></div>
              )}
              {selectedDog.behaviorNotes && (
                <div><span className="font-semibold text-slate-700">Comportement : </span><span className="text-slate-600">{selectedDog.behaviorNotes}</span></div>
              )}
              {selectedDog.feedingNotes && (
                <div><span className="font-semibold text-slate-700">Alimentation : </span><span className="text-slate-600">{selectedDog.feedingNotes}</span></div>
              )}
              {selectedDog.vetContact && (
                <div><span className="font-semibold text-slate-700">Vétérinaire : </span><span className="text-slate-600">{selectedDog.vetContact}</span></div>
              )}
              {selectedDog.sitterInstructions && (
                <div className="rounded-2xl bg-amber-50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Instructions</p>
                  <p className="text-slate-700">{selectedDog.sitterInstructions}</p>
                </div>
              )}
            </div>
            <Link
              href="/account/dogs"
              className="mt-5 flex w-full items-center justify-center rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => setDogProfileOpen(false)}
            >
              Modifier le profil
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
