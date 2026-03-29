"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import PageLoader from "@/components/ui/PageLoader";

const LOGIN_KEY = "ds_login_transit";
const TTL = 30_000;
const AUTO_DISMISS_MS = 10_000;

type TransitCtxValue = { dismissTransit: () => void };
const TransitCtx = createContext<TransitCtxValue>({ dismissTransit: () => {} });
export const useTransit = () => useContext(TransitCtx);

function isLoginTransit(): boolean {
  try {
    const ts = sessionStorage.getItem(LOGIN_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < TTL;
  } catch {
    return false;
  }
}

export default function TransitOverlay({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);
  const isStaggerRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (isLoginTransit()) {
      setActive(true);
      isStaggerRef.current = window.location.pathname.includes("/post-login");
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      setReady(true);
      try { sessionStorage.removeItem(LOGIN_KEY); } catch {}
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [active]);

  const dismissTransit = useCallback(() => {
    setReady(true);
    try { sessionStorage.removeItem(LOGIN_KEY); } catch {}
  }, []);

  return (
    <TransitCtx.Provider value={{ dismissTransit }}>
      {active && (
        <PageLoader
          label="Connexion en cours…"
          ready={ready}
          minDuration={isStaggerRef.current ? 2800 : 800}
          static={!isStaggerRef.current}
        />
      )}
      {children}
    </TransitCtx.Provider>
  );
}
