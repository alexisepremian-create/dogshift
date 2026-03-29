"use client";

import { useState, useEffect } from "react";
import Spinner from "@/components/ui/Spinner";

const LOGIN_KEY = "ds_login_transit";
const TTL = 30_000;

function isLoginTransit() {
  try {
    const ts = sessionStorage.getItem(LOGIN_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < TTL;
  } catch {
    return false;
  }
}

export default function PageLoader({ label = "Chargement…" }: { label?: string }) {
  const [displayLabel] = useState(() => {
    if (typeof window === "undefined") return label;
    return isLoginTransit() ? "Connexion en cours…" : label;
  });

  useEffect(() => {
    return () => {
      try { sessionStorage.removeItem(LOGIN_KEY); } catch {}
    };
  }, []);

  return (
    <div
      className="ds-viewport fixed inset-0 z-50 flex w-full items-center justify-center bg-white font-sans"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex h-[120px] w-[260px] flex-col items-center justify-center text-center">
        <Spinner className="h-12 w-12 text-slate-700" />
        <p className="mt-4 h-5 text-sm font-medium leading-5 text-slate-700">{displayLabel}</p>
      </div>
    </div>
  );
}
