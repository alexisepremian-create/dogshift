"use client";

import { useEffect, useRef } from "react";
import PageLoader from "@/components/ui/PageLoader";

export default function PostLoginPage() {
  const startedRef = useRef(false);

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
        const finalTarget = target === "/host" && next ? next : target;

        try { sessionStorage.setItem("ds_login_transit", String(Date.now())); } catch {}
        window.location.replace(finalTarget);
      } catch {
        window.location.assign("/login?force=1");
      }
    })();
  }, []);

  return <PageLoader label="Connexion en cours…" />;
}
