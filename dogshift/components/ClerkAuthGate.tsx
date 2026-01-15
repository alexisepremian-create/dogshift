"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import PageLoader from "@/components/ui/PageLoader";

export default function ClerkAuthGate({
  children,
  redirectTo = "/login",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [readyToRender, setReadyToRender] = useState(false);

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

  return <>{children}</>;
}
