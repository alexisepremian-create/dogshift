"use client";

import { useState, useEffect } from "react";
import PageLoader from "@/components/ui/PageLoader";

const SESSION_KEY = "ds_protected_overlay_shown";

export default function ProtectedOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setShow(true);
  }, []);

  if (!show) return null;

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
