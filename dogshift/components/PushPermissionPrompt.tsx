"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Bell, X } from "lucide-react";

const DISMISSED_KEY = "ds_push_prompt_dismissed_until";
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── VAPID key helper ──────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export type PushPermission = "default" | "granted" | "denied";

export function usePushNotifications() {
  const { isLoaded, isSignedIn } = useUser();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      const supported =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setIsSupported(supported);
      if (supported) setPermission(Notification.permission as PushPermission);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isSupported || !isLoaded || !isSignedIn) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (!cancelled) setIsSubscribed(!!sub); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [isSupported, isLoaded, isSignedIn]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    const perm = await Notification.requestPermission();
    setPermission(perm as PushPermission);
    if (perm !== "granted") return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("[push] subscribe error", err);
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      console.error("[push] unsubscribe error", err);
    }
  }, [isSupported]);

  return { isSupported, permission, isSubscribed, subscribe, unsubscribe };
}

// ── Banner component ──────────────────────────────────────────────────────────

type Props = {
  variant?: "sitter" | "owner";
};

export default function PushPermissionPrompt({ variant = "owner" }: Props) {
  const { isLoaded, isSignedIn } = useUser();
  const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isSupported) return;
    if (permission === "granted" || permission === "denied") return;
    if (isSubscribed) return;

    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    // Show only after an engaging action — caller sets the sessionStorage flag
    const engaged = sessionStorage.getItem("ds_push_eligible");
    if (!engaged) return;

    const t = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(t);
  }, [isLoaded, isSignedIn, isSupported, permission, isSubscribed]);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_DURATION_MS));
  }

  async function handleActivate() {
    setLoading(true);
    const ok = await subscribe();
    setLoading(false);
    if (ok) setVisible(false);
    else dismiss(); // user denied — don't show again
  }

  if (!visible) return null;

  const text =
    variant === "sitter"
      ? "Active les notifications pour ne rater aucune demande de réservation."
      : "Active les notifications pour suivre tes réservations en temps réel.";

  return (
    <div
      role="banner"
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-slate-200 bg-white px-4 py-3 shadow-lg sm:px-6"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
          <Bell className="h-4 w-4 text-blue-600" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Activer les notifications</p>
          <p className="text-xs text-slate-500">{text}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={handleActivate}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: "var(--dogshift-blue)" }}
          >
            {loading ? "…" : "Activer"}
          </button>
          <button
            onClick={dismiss}
            aria-label="Plus tard"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helper to mark user as eligible (call after an engaging action) ───────────

export function markPushEligible() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("ds_push_eligible", "1");
  }
}
