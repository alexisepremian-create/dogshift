"use client";

import { useEffect, useRef, useState } from "react";

export default function HostHydrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const latchedRef = useRef(false);

  useEffect(() => {
    if (latchedRef.current) return;
    latchedRef.current = true;
    setReady(true);
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}
