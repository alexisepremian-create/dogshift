"use client";

import { useEffect, useMemo, useState } from "react";

import { useHostUser } from "@/components/HostUserProvider";
import PageLoader from "@/components/ui/PageLoader";

export default function HostDataGate({ children }: { children: React.ReactNode }) {
  const host = useHostUser();
  const [readyToRender, setReadyToRender] = useState(false);

  const hostReady = useMemo(() => {
    if (!host.sitterId) return false;
    if (typeof host.profileCompletion !== "number") return false;
    return true;
  }, [host.profileCompletion, host.sitterId]);

  useEffect(() => {
    if (!hostReady) return;

    let rafId = 0;
    const t = window.setTimeout(() => {
      rafId = window.requestAnimationFrame(() => setReadyToRender(true));
    }, 150);

    return () => {
      window.clearTimeout(t);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [hostReady]);

  if (!hostReady || !readyToRender) {
    return <PageLoader label="Chargement…" />;
  }

  return <>{children}</>;
}
