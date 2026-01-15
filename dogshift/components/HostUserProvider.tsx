"use client";

import { createContext, useContext } from "react";

export type HostUser = {
  sitterId: string | null;
  published: boolean;
  publishedAt: string | null;
  profile: unknown;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  profileCompletion: number;
};

const HostUserContext = createContext<HostUser | null>(null);

export function HostUserProvider({ value, children }: { value: HostUser; children: React.ReactNode }) {
  return <HostUserContext.Provider value={value}>{children}</HostUserContext.Provider>;
}

export function useHostUser() {
  const ctx = useContext(HostUserContext);
  if (!ctx) {
    throw new Error("useHostUser must be used within HostUserProvider");
  }
  return ctx;
}
