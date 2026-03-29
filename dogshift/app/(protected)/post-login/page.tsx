"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageLoader from "@/components/ui/PageLoader";

export default function PostLoginPage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    try { sessionStorage.setItem("ds_login_transit", String(Date.now())); } catch {}

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
        const redirect = data?.redirect ?? "/host";
        const t = redirect === "/host" && next ? next : redirect;
        setTarget(t.startsWith("/host") ? t : "/host");
      } catch {
        window.location.assign("/login?force=1");
      }
    })();
  }, [router]);

  function handleDone() {
    if (target) router.replace(target);
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
