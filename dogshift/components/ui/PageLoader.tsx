/* eslint-disable react-hooks/purity */
"use client";

import { useState, useEffect, useRef } from "react";
import RunningDog from "@/components/ui/RunningDog";
import DashboardSkeleton from "@/components/ui/DashboardSkeleton";

/* ── Config ────────────────────────────────────────────────────── */

const DEFAULT_MIN = 800;
// 350ms fade-out — during this window, the overlay is visually dismissing but
// would block taps unless we explicitly disable pointer-events (see render).
const FADE_MS = 350;

export const PAGE_LOADER_MIN_DURATION_MS = DEFAULT_MIN;

/* ── Component ─────────────────────────────────────────────────── */

type Props = {
  /** Kept for API compatibility — no longer rendered (loaders show only the
   *  animation per the native redesign). */
  label?: string;
  /** Signal that content/data behind the loader is ready */
  ready?: boolean;
  /** Called when the overlay is fully dismissed (after fade-out) */
  onDone?: () => void;
  /** Minimum ms before the loader can start dismissing (default 800) */
  minDuration?: number;
  /** If true, skip fade-out — overlay stays visible (for page navigations) */
  persist?: boolean;
  /** Retained for API compatibility (the running-dog loader has no separate
   *  static vs animated variant — it always runs). */
  static?: boolean;
};

export default function PageLoader({
  ready,
  onDone,
  minDuration = DEFAULT_MIN,
  persist = false,
}: Props) {
  const mountRef = useRef(Date.now());
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // NATIVE: never show the running dog — the founder wants a loading skeleton
  // to make the wait feel app-like ("je veux plus du tout le voir … je veux
  // skeleton de chargement pour faire patienter le client"). This is the
  // belt-and-suspenders layer: even loading.tsx files that still render
  // <PageLoader /> directly (e.g. /sitter/[id], /post-login) get a skeleton
  // in the app instead of the dog. Read synchronously so the very first client
  // render is already correct (no 1-frame dog flash).
  const [isNative] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-native") === "true",
  );

  const [phase, setPhase] = useState<"animate" | "fadeOut" | "done">("animate");

  useEffect(() => {
    if (ready !== true) return;

    const elapsed = Date.now() - mountRef.current;
    const wait = Math.max(0, minDuration - elapsed);

    if (persist) {
      const t = setTimeout(() => {
        onDoneRef.current?.();
      }, wait);
      return () => clearTimeout(t);
    }

    const t1 = setTimeout(() => setPhase("fadeOut"), wait);
    const t2 = setTimeout(() => {
      setPhase("done");
      onDoneRef.current?.();
    }, wait + FADE_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready, minDuration, persist]);

  if (phase === "done") return null;

  // NATIVE: render the skeleton IN-FLOW (not a fixed full-screen overlay) so the
  // bottom nav (z-50, in the root layout) stays visible during loading. A
  // full-screen overlay covered the nav → founder bug "la nav barre disparait
  // pdt le chargement". The skeleton shape matches the section content so the
  // hand-off to the page's own client-fetch skeleton reads as one continuous
  // load, not a flash.
  if (isNative) {
    return (
      <div
        data-page-loader="1"
        className="w-full px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)" }}
        aria-busy="true"
        aria-live="polite"
      >
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div
      // Marker used by NavigationOverlayController to hand off the static
      // navigation overlay to this animated PageLoader once it commits.
      // Without it, the controller might tear down the static overlay
      // before this loader mounts, causing a 1-frame footer flash.
      data-page-loader="1"
      className="ds-viewport fixed inset-0 z-[9999] flex w-full items-center justify-center bg-white font-sans"
      style={{
        transition: phase === "fadeOut" ? `opacity ${FADE_MS}ms ease` : undefined,
        opacity: phase === "fadeOut" ? 0 : 1,
        // During fade-out, let taps pass through to the underlying page so
        // buttons feel responsive instead of being silently blocked.
        pointerEvents: phase === "fadeOut" ? "none" : undefined,
      }}
      aria-busy={phase === "animate" ? "true" : "false"}
      aria-live="polite"
    >
      <RunningDog size={200} className="text-[#7c3aed]" />
    </div>
  );
}
