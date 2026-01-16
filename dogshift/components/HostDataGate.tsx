"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";

import { useHostUser } from "@/components/HostUserProvider";
import PageLoader from "@/components/ui/PageLoader";

const HOST_READY_LATCH_BY_USER_ID = new Map<string, true>();

export default function HostDataGate({ children }: { children: React.ReactNode }) {
  const host = useHostUser();
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [readyToRender, setReadyToRender] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const warnedTimeoutRef = useRef(false);

  const hostReady = useMemo(() => {
    if (!host.sitterId) return false;
    if (typeof host.profileCompletion !== "number") return false;
    return true;
  }, [host.profileCompletion, host.sitterId]);

  const userId = typeof user?.id === "string" ? user.id : null;
  const latched = Boolean(userId && HOST_READY_LATCH_BY_USER_ID.get(userId));

  useEffect(() => {
    if (!userId) return;
    setReadyToRender(Boolean(HOST_READY_LATCH_BY_USER_ID.get(userId)));
    setTimedOut(false);
    warnedTimeoutRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;
    if (host.sitterId) return;

    console.log("[HostDataGate] redirect/fallback", {
      userId,
      isLoaded,
      isSignedIn,
      hostReady,
      hasHost: Boolean(host),
      hostUserDataKeys: Object.keys(host ?? {}),
      latched,
      reason: "SIGNED_IN_BUT_NOT_HOST",
    });

    router.replace("/become-sitter");
  }, [host, hostReady, isLoaded, isSignedIn, latched, router, userId]);

  useEffect(() => {
    if (!hostReady) return;

    if (userId) {
      HOST_READY_LATCH_BY_USER_ID.set(userId, true);
    }

    let rafId = 0;
    const t = window.setTimeout(() => {
      rafId = window.requestAnimationFrame(() => setReadyToRender(true));
    }, 150);

    return () => {
      window.clearTimeout(t);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [hostReady, userId]);

  useEffect(() => {
    if (readyToRender) return;

    const t = window.setTimeout(() => {
      setTimedOut(true);
    }, 6000);

    return () => {
      window.clearTimeout(t);
    };
  }, [readyToRender]);

  const waiting = !hostReady || !readyToRender;

  useEffect(() => {
    if (!waiting) return;
    if (process.env.NODE_ENV === "production") return;
    console.log("[HostDataGate] waiting", {
      userId,
      isLoaded,
      isSignedIn,
      hostReady,
      hasHost: Boolean(host),
      latched,
    });
  }, [host, hostReady, isLoaded, isSignedIn, latched, userId, waiting]);

  if (waiting && timedOut) {
    if (!warnedTimeoutRef.current) {
      warnedTimeoutRef.current = true;
      console.warn("[HostDataGate] timeout", {
        reason: "HOST_READY_TIMEOUT",
        userId,
        isLoaded,
        isSignedIn,
        hostReady,
        hostUserDataKeys: Object.keys(host ?? {}),
        latched,
      });
    }

    return (
      <div className="fixed inset-0 z-50 flex w-full items-center justify-center bg-white font-sans">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <p className="text-base font-semibold text-slate-900">On finalise ton accès…</p>
          <p className="mt-2 text-sm text-slate-600">Si ça prend trop longtemps, tu peux réessayer ou revenir plus tard.</p>
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => {
                console.log("[HostDataGate] redirect/fallback", {
                  userId,
                  isLoaded,
                  isSignedIn,
                  hostReady,
                  hasHost: Boolean(host),
                  hostUserDataKeys: Object.keys(host ?? {}),
                  latched,
                  reason: "USER_REFRESH",
                });
                router.refresh();
              }}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
            >
              Réessayer
            </button>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Retour accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (waiting) {
    return <PageLoader label="Chargement…" />;
  }

  return <>{children}</>;
}
