"use client";

import { createContext, useContext } from "react";

import type { SitterLifecycleStatus } from "@/lib/sitterContract";

export type HostUser = {
  sitterId: string | null;
  published: boolean;
  publishedAt: string | null;
  profile: unknown;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  profileCompletion: number;
  lifecycleStatus: SitterLifecycleStatus;
  contractSignedAt: string | null;
  activatedAt: string | null;
  activationCodeIssuedAt: string | null;
};

export function makeHostUserValuePreview(args: { sitterId: string | null; profile: unknown }): HostUser {
  return {
    sitterId: args.sitterId,
    published: false,
    publishedAt: null,
    profile: args.profile,
    termsAcceptedAt: null,
    termsVersion: null,
    profileCompletion: 0,
    lifecycleStatus: "application_received",
    contractSignedAt: null,
    activatedAt: null,
    activationCodeIssuedAt: null,
  };
}

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
