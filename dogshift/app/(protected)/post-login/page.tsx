"use client";

import { useEffect, useRef } from "react";

const SPLASH_DONE_KEY = "ds_splash_done";
const MIN_ANIMATION = 2800;

export default function PostLoginPage() {
  const startedRef = useRef(false);
  const mountTime = useRef(Date.now());

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

        const elapsed = Date.now() - mountTime.current;
        const wait = Math.max(0, MIN_ANIMATION - elapsed);

        setTimeout(() => {
          if (finalTarget.startsWith("/host")) {
            try { sessionStorage.setItem(SPLASH_DONE_KEY, "1"); } catch {}
          }
          window.location.replace(finalTarget);
        }, wait);
      } catch {
        window.location.assign("/login?force=1");
      }
    })();
  }, []);

  return null;
}
