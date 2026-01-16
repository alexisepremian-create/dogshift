"use client";

import { useEffect, useRef, useState } from "react";

import PageLoader from "@/components/ui/PageLoader";

export default function HostHydrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const latchedRef = useRef(false);

  useEffect(() => {
    if (latchedRef.current) return;
    latchedRef.current = true;
    setReady(true);
  }, []);

  if (!ready) {
    return <PageLoader label="Chargement…" />;
  }

  return <>{children}</>;
}
