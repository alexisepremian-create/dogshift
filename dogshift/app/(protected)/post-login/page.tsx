"use client";

import { useEffect, useRef, useState } from "react";
import PageLoader from "@/components/ui/PageLoader";

export default function PostLoginPage() {
  const startedRef = useRef(false);
  const targetRef = useRef<string | null>(null);
  const [targetReady, setTargetReady] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const next = (params.get("next") ?? "").trim();

    (async () => {
      try {
        const res = await fetch("/api/auth/resolve-redirect", { cache: "no-store" });
        if (res.status === 401) {
          window.location.assign("/login");
          return;
        }
        const data = await res.json().catch(() => null);
        const target = data?.redirect ?? "/account";
        targetRef.current = target === "/host" && next ? next : target;
        setTargetReady(true);
      } catch {
        window.location.assign("/login?force=1");
      }
    })();
  }, []);

  function handleDone() {
    const t = targetRef.current;
    if (!t) return;
    try { sessionStorage.setItem("ds_login_transit", String(Date.now())); } catch {}
    window.location.replace(t);
  }

  return (
    <PageLoader
      label="Connexion en cours…"
      ready={targetReady}
      minDuration={2800}
      persist
      onDone={handleDone}
    />
  );
}
