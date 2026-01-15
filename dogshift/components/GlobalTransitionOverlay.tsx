"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
  const { navigating, hostReadyLatched, hostMountedLatched } = useGlobalTransitionState();

  const isPublicRoute = useMemo(() => {
    const p = pathname ?? "";
    if (!p) return true;
    if (p === "/") return true;
    if (p === "/access") return true;
    if (p.startsWith("/api")) return true;
    if (p.startsWith("/login")) return true;
    if (p.startsWith("/signup")) return true;
    if (p.startsWith("/register")) return true;
    if (p.startsWith("/auth")) return true;
    if (p.startsWith("/search")) return true;
    if (p.startsWith("/sitters")) return true;
    if (p.startsWith("/sitter/")) return true;
    if (p.startsWith("/help")) return true;
    if (p.startsWith("/cgu")) return true;
    if (p.startsWith("/merci")) return true;
    if (p.startsWith("/annule")) return true;
    if (p.startsWith("/paiement")) return true;
    if (p.startsWith("/booking")) return true;
    return false;
  }, [pathname]);

  const isProtectedRoute = useMemo(() => {
    const p = pathname ?? "";
    if (!p) return false;
    if (isPublicRoute) return false;
    return true;
  }, [isPublicRoute, pathname]);

  const needsHostData = useMemo(() => {
    const p = pathname ?? "";
    if (!p) return false;
    return p.startsWith("/host");
  }, [pathname]);

  const needsHostMounted = useMemo(() => {
    const p = pathname ?? "";
    if (!p) return false;
    return p.startsWith("/host");
  }, [pathname]);

  const isPostLogin = useMemo(() => (pathname ?? "") === "/post-login", [pathname]);

  const protectedNeedsAuth = isProtectedRoute || isPostLogin;

  const authReady = isLoaded && isSignedIn;
  const hostReady = !needsHostData || hostReadyLatched;
  const hostMountedReady = !needsHostMounted || hostMountedLatched;

  const rawShouldShow = navigating || (protectedNeedsAuth && (!authReady || !hostReady || !hostMountedReady));

  const [show, setShow] = useState(rawShouldShow);
  const [fallbackLabel, setFallbackLabel] = useState<string | null>(null);
  const hideTokenRef = useRef(0);

  useEffect(() => {
    if (rawShouldShow) {
      hideTokenRef.current += 1;
      const rafId = window.requestAnimationFrame(() => setShow(true));
      return () => window.cancelAnimationFrame(rafId);
    }

    const token = (hideTokenRef.current += 1);

    let raf1 = 0;
    let raf2 = 0;
    let t = 0;

    raf1 = window.requestAnimationFrame(() => {
      if (hideTokenRef.current !== token) return;
      raf2 = window.requestAnimationFrame(() => {
        if (hideTokenRef.current !== token) return;
        t = window.setTimeout(() => {
          if (hideTokenRef.current !== token) return;
          window.requestAnimationFrame(() => {
            if (hideTokenRef.current !== token) return;
            setShow(false);
          });
        }, 200);
      });
    });

    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      if (t) window.clearTimeout(t);
    };
  }, [rawShouldShow]);

  useEffect(() => {
    if (!show) {
      const rafId = window.requestAnimationFrame(() => setFallbackLabel(null));
      return () => window.cancelAnimationFrame(rafId);
    }

    const t = window.setTimeout(() => {
      setFallbackLabel("Ça prend un peu plus de temps…");
    }, 10000);

    return () => window.clearTimeout(t);
  }, [show]);

  useEffect(() => {
    // keep overlay during route changes and for a short stabilization window
    if (!pathname) return;

    const isProtectedNow = isProtectedRoute || pathname === "/post-login";
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

  useEffect(() => {
    const el = typeof document !== "undefined" ? document.getElementById("ds-preloader") : null;
    if (!el) return;

    if (show) {
      el.style.display = "flex";
      return;
    }

    el.parentElement?.removeChild(el);
  }, [show]);

  useEffect(() => {
    let debugOn = false;
    try {
      debugOn = window.localStorage.getItem("ds_debug_flash") === "1";
    } catch {
      debugOn = false;
    }
    if (!debugOn) return;

    const reasons: string[] = [];
    if (navigating) reasons.push("navigating");
    if (protectedNeedsAuth && !isLoaded) reasons.push("authLoading");
    if (protectedNeedsAuth && isLoaded && !isSignedIn) reasons.push("notSignedIn");
    if (protectedNeedsAuth && authReady && !hostReady) reasons.push("hostNotReady");
    if (protectedNeedsAuth && authReady && hostReady && !hostMountedReady) reasons.push("hostNotMounted");
    console.log("[flash-debug]", {
      pathname,
      overlay: show,
      navigating,
      protectedNeedsAuth,
      authReady,
      hostReady,
      hostMountedReady,
      reasons,
    });
  }, [authReady, hostMountedReady, hostReady, isLoaded, isSignedIn, navigating, pathname, protectedNeedsAuth, show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <PageLoader label={fallbackLabel ?? (isPostLogin ? "Connexion en cours…" : "Chargement…")} />
    </div>
  );
}
