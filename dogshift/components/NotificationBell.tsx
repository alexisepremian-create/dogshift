"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
};

function formatBadge(n: number) {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 99) return "99+";
  return String(n);
}

function relativeTime(iso: string) {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l’instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days} j`;
}

export default function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const badge = useMemo(() => formatBadge(unread), [unread]);

  async function refreshUnread() {
    try {
      const res = await fetch("/api/notifications/unread-count", { method: "GET" });
      const payload = (await res.json()) as { ok?: boolean; total?: number };
      if (res.ok && payload.ok && typeof payload.total === "number") {
        setUnread(payload.total);
      }
    } catch {
      // ignore
    }
  }

  async function refreshList() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications?limit=10", { method: "GET" });
      const payload = (await res.json()) as { ok?: boolean; items?: NotificationItem[] };
      if (!res.ok || !payload.ok) {
        setError("Impossible de charger les notifications.");
        setItems([]);
        return;
      }
      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      setItems(nextItems);

      const localUnread = nextItems.reduce((acc, n) => acc + (n.readAt ? 0 : 1), 0);
      setUnread((prev) => (prev > 0 ? prev : localUnread));
    } catch {
      setError("Impossible de charger les notifications.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      const payload = (await res.json()) as { ok?: boolean };
      if (!res.ok || !payload.ok) return;
      await refreshUnread();
      await refreshList();
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshUnread();
    const i = window.setInterval(() => {
      void refreshUnread();
    }, 45_000);
    return () => window.clearInterval(i);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshUnread();
    void refreshList();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const btn =
    "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";

  return (
    <div ref={rootRef} className={"relative" + (className ? ` ${className}` : "")}> 
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notifications"
        className={btn}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {badge ? (
          <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_-40px_rgba(2,6,23,0.25)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]"
            >
              Tout marquer comme lu
            </button>
          </div>

          <div className="max-h-[420px] overflow-auto p-2">
            {loading ? (
              <div className="p-3 text-sm text-slate-600">Chargement…</div>
            ) : error ? (
              <div className="p-3 text-sm text-rose-700">{error}</div>
            ) : items.length === 0 ? (
              <div className="p-3 text-sm text-slate-600">Aucune notification</div>
            ) : (
              <div className="space-y-2">
                {items.map((n) => {
                  const isUnread = !n.readAt;
                  const content = (
                    <div
                      className={
                        "rounded-2xl border px-3 py-3 transition" +
                        (isUnread ? " border-slate-200 bg-slate-50" : " border-slate-200 bg-white")
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{n.title}</p>
                          {n.body ? <p className="mt-1 text-xs text-slate-600 line-clamp-2">{n.body}</p> : null}
                        </div>
                        <p className="shrink-0 text-[11px] font-medium text-slate-500">{relativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  );

                  return n.url ? (
                    <Link key={n.id} href={n.url} onClick={() => setOpen(false)} className="block">
                      {content}
                    </Link>
                  ) : (
                    <div key={n.id}>{content}</div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
