"use client";

import { SessionProvider } from "next-auth/react";

import { MaintenanceProvider } from "@/components/platform/MaintenanceProvider";
import NativeAppBridge from "@/components/native/NativeAppBridge";

/**
 * Wraps the app with Auth.js v5's SessionProvider so `useSession()` works
 * in every client component, plus the maintenance/banner provider.
 *
 * Also mounts the NativeAppBridge which initializes Capacitor APIs (push
 * notifications, deep linking, status bar) when running inside the native
 * iOS/Android shell. The bridge is a no-op on plain web.
 */
export default function SessionAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <MaintenanceProvider>
        <NativeAppBridge />
        {children}
      </MaintenanceProvider>
    </SessionProvider>
  );
}
