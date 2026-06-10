"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from "react";
import PageLoader from "@/components/ui/PageLoader";
import NativeBrandedLoader from "@/components/native/NativeBrandedLoader";
import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

const SESSION_KEY = "ds_protected_overlay_shown";

export default function ProtectedOverlay() {
  const isNative = useIsNativeApp();
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setShow(true);
  }, []);

  // Native: keep the branded cover only long enough to bridge the dashboard
  // mount (~600 ms), then fade — no long 2800 ms wait. Web keeps the animated
  // PageLoader below.
  useEffect(() => {
    if (!show || !isNative) return;
    const fade = setTimeout(() => setFadeOut(true), 600);
    const done = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setShow(false);
    }, 1000);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [show, isNative]);

  if (!show) return null;

  if (isNative) {
    return <NativeBrandedLoader fadeOut={fadeOut} />;
  }

  return (
    <PageLoader
      ready={true}
      minDuration={2800}
      onDone={() => {
        sessionStorage.setItem(SESSION_KEY, "1");
        setShow(false);
      }}
      static={false}
    />
  );
}
