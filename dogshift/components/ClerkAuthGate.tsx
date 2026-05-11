"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import PageLoader, { PAGE_LOADER_MIN_DURATION_MS } from "@/components/ui/PageLoader";

export default function ClerkAuthGate({
  children,
  redirectTo = "/login",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { status: __sessionStatus } = useSession();
  const isLoaded = __sessionStatus !== "loading";
  const isSignedIn = __sessionStatus === "authenticated";
  const [readyToRender, setReadyToRender] = useState(false);
  const mountRef = useRef(Date.now());
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const elapsed = Date.now() - mountRef.current;
    const remaining = Math.max(0, PAGE_LOADER_MIN_DURATION_MS - elapsed);
    if (remaining === 0) {
      setMinElapsed(true);
      return;
    }
    const t = setTimeout(() => setMinElapsed(true), remaining);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) return;
    router.replace(redirectTo);
  }, [isLoaded, isSignedIn, redirectTo, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let rafId = 0;
    const t = window.setTimeout(() => {
      rafId = window.requestAnimationFrame(() => setReadyToRender(true));
    }, 500);

    return () => {
      window.clearTimeout(t);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return <PageLoader label="Chargement…" />;
  }

  if (!isSignedIn) {
    return <PageLoader label="Connexion en cours…" />;
  }

  if (!readyToRender) {
    return <PageLoader label="Chargement…" />;
  }

  if (!minElapsed) {
    return <PageLoader label="Chargement…" />;
  }

  return <>{children}</>;
}
