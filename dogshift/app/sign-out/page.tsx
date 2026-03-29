"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import PageLoader from "@/components/ui/PageLoader";

export default function SignOutPage() {
  const { isLoaded: authLoaded } = useAuth();
  const clerk = useClerk();
  const startedRef = useRef(false);
  const [done, setDone] = useState(false);

  const redirectRef = useRef(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("redirect")?.trim() || "/login?force=1"
      : "/login?force=1",
  );

  useEffect(() => {
    if (!authLoaded || startedRef.current) return;
    startedRef.current = true;

    try { window.localStorage.removeItem("ds_auth_user"); } catch {}

    clerk.signOut().then(() => setDone(true)).catch(() => setDone(true));
  }, [authLoaded, clerk]);

  function handleDone() {
    window.location.replace(redirectRef.current);
  }

  return (
    <PageLoader
      label="Déconnexion…"
      ready={done}
      onDone={handleDone}
      minDuration={1800}
      persist
    />
  );
}
