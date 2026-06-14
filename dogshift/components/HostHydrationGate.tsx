"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional: defer children to after hydration (same pattern as lib/native/useIsNativeApp). */

import { useEffect, useRef, useState } from "react";

import NativeDashboardLoading from "@/components/native/NativeDashboardLoading";

export default function HostHydrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const latchedRef = useRef(false);

  useEffect(() => {
    if (latchedRef.current) return;
    latchedRef.current = true;
    setReady(true);
  }, []);

  // Before hydration latches, render the native skeleton (not null = white) so
  // there is no white frame between the route fallback and the shell. Web → null.
  if (!ready) return <NativeDashboardLoading />;

  return <>{children}</>;
}
