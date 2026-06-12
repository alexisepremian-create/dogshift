"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from "react";
import PageLoader from "@/components/ui/PageLoader";
import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

const SESSION_KEY = "ds_protected_overlay_shown";

export default function ProtectedOverlay() {
  const isNative = useIsNativeApp();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setShow(true);
  }, []);

  if (!show) return null;

  // Same running-dog loader on native and web (one consistent in-app loader —
  // no separate purple "branded" cover anymore). Native bridges the dashboard
  // mount with a shorter minimum so it doesn't feel sluggish; web keeps the
  // longer reveal.
  return (
    <PageLoader
      ready={true}
      minDuration={isNative ? 900 : 2800}
      onDone={() => {
        sessionStorage.setItem(SESSION_KEY, "1");
        setShow(false);
      }}
    />
  );
}
