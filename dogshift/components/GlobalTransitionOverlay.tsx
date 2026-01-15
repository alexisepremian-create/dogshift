"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import PageLoader from "@/components/ui/PageLoader";
import {
  endGlobalNavigation,
  getGlobalTransitionSnapshot,
  startGlobalNavigation,
  subscribeGlobalTransition,
} from "@/components/globalTransitionStore";

function useGlobalTransitionState() {
  return useSyncExternalStore(subscribeGlobalTransition, getGlobalTransitionSnapshot, getGlobalTransitionSnapshot);
}

export default function GlobalTransitionOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const { navigating, hostReadyLatched } = useGlobalTransitionState();

  const isHostArea = useMemo(() => (pathname ?? "").startsWith("/host"), [pathname]);
  const isPostLogin = useMemo(() => (pathname ?? "") === "/post-login", [pathname]);

  const protectedNeedsAuth = isHostArea || isPostLogin;

  const authReady = isLoaded && isSignedIn;
  const hostReady = !isHostArea || hostReadyLatched;

  const rawShouldShow = navigating || (protectedNeedsAuth && (!authReady || !hostReady));

  const [show, setShow] = useState(rawShouldShow);

  useEffect(() => {
    if (rawShouldShow) {
      const rafId = window.requestAnimationFrame(() => setShow(true));
      return () => window.cancelAnimationFrame(rafId);
    }

    const t = window.setTimeout(() => {
      window.requestAnimationFrame(() => setShow(false));
    }, 250);

    return () => window.clearTimeout(t);
  }, [rawShouldShow]);

  useEffect(() => {
    // keep overlay during route changes and for a short stabilization window
    if (!pathname) return;

    const isProtectedNow = pathname.startsWith("/host") || pathname === "/post-login";
    if (!isProtectedNow) return;

    startGlobalNavigation();

    let rafId = 0;
    const t = window.setTimeout(() => {
      rafId = window.requestAnimationFrame(() => endGlobalNavigation());
    }, 250);

    return () => {
      window.clearTimeout(t);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <PageLoader label={isPostLogin ? "Connexion en cours…" : "Chargement…"} />
    </div>
  );
}
