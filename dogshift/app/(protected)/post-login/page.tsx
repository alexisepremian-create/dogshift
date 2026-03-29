"use client";

import { useEffect, useRef, useState } from "react";
import PageLoader from "@/components/ui/PageLoader";

export default function PostLoginPage() {
  const startedRef = useRef(false);
  const [target, setTarget] = useState<string | null>(null);

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
        const redirect = data?.redirect ?? "/account";
        setTarget(redirect === "/host" && next ? next : redirect);
      } catch {
        window.location.assign("/login?force=1");
      }
    })();
  }, []);

  function handleDone() {
    if (target) window.location.replace(target);
  }

  return (
    <PageLoader
      label="Connexion en cours…"
      ready={target !== null}
      onDone={handleDone}
      minDuration={2800}
      persist
    />
  );
}
