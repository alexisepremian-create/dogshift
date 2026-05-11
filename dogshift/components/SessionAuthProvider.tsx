"use client";

import { SessionProvider } from "next-auth/react";

import { MaintenanceProvider } from "@/components/platform/MaintenanceProvider";

/**
 * Wraps the app with Auth.js v5's SessionProvider so `useSession()` works
 * in every client component, plus the maintenance/banner provider.
 *
 * Replaces the previous ClerkProvider-only setup (Clerk's hooks were
 * implicitly available via `<ClerkProvider>` in app/layout.tsx).
 */
export default function SessionAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <MaintenanceProvider>{children}</MaintenanceProvider>
    </SessionProvider>
  );
}
