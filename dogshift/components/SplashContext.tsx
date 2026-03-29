"use client";

import { createContext, useCallback, useContext, useState } from "react";

type SplashContextValue = {
  ready: boolean;
  signalReady: () => void;
};

const SplashCtx = createContext<SplashContextValue>({
  ready: false,
  signalReady: () => {},
});

export const useSplash = () => useContext(SplashCtx);

export function SplashProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const signalReady = useCallback(() => setReady(true), []);

  return (
    <SplashCtx.Provider value={{ ready, signalReady }}>
      {children}
    </SplashCtx.Provider>
  );
}
