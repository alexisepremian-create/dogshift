"use client";

import { createContext, useContext } from "react";

import type { HostContractAmendmentState } from "@/lib/contractAmendments";
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
  verificationStatus: string;
  stripeAccountStatus: string | null;
  contractSignedAt: string | null;
  activatedAt: string | null;
  activationCodeIssuedAt: string | null;
  contractAmendment: HostContractAmendmentState;
  /** Services enabled in ServiceConfig (enum strings). */
  enabledServices?: string[];
  /** True when every enabled service has ≥1 bookable availability rule. */
  availabilityCoverageOk?: boolean;
  /** Enabled services with no bookable availability (the publish blockers). */
  missingAvailabilityServices?: string[];
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
    verificationStatus: "not_verified",
    stripeAccountStatus: null,
    contractSignedAt: null,
    activatedAt: null,
    activationCodeIssuedAt: null,
    contractAmendment: {
      activeAmendment: null,
      isUpToDate: true,
      acceptedAt: null,
      acceptedVersion: null,
      needsAcceptance: false,
    },
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
