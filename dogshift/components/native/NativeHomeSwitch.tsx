"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useIsNativeApp } from "@/lib/native/useIsNativeApp";
import NativeMapHome from "@/components/native/NativeMapHome";

/**
 * Client-side switch : renders the full-screen native map home when running
 * inside the Capacitor shell, otherwise lets the existing marketing homepage
 * (children) render unchanged.
 *
 * **Auth gate (native only)**: unauthenticated users are redirected to /login.
 * The native app requires an account — the onboarding's exit paths all lead to
 * /login or /signup, and this gate catches returning users whose session expired.
 */
export default function NativeHomeSwitch({ children }: { children: React.ReactNode }) {
  const isNative = useIsNativeApp();
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isNative && status === "unauthenticated") {
      router.replace("/login");
    }
  }, [isNative, status, router]);

  // `useIsNativeApp()` is false on the first client render (SSR-safe), so on
  // the native app the WEB homepage (children) would paint for a frame before
  // flipping to <NativeMapHome /> — a visible flash of the marketing hero +
  // sitter cards (founder bug). We still render the web homepage here (so SSR +
  // first client render match → no hydration mismatch), but tag it with
  // `data-ds-web-home`: globals.css hides that element on native via the
  // synchronous `html[data-native]` attribute set by the boot script, so it
  // never paints in the app. `display:contents` keeps it layout-neutral on web.
  if (!isNative) {
    return (
      <div data-ds-web-home style={{ display: "contents" }}>
        {children}
      </div>
    );
  }

  // While session is loading, show nothing (splash overlay still covers)
  if (status === "loading") return null;

  // Unauthenticated → redirect is firing, show nothing
  if (status === "unauthenticated") return null;

  return <NativeMapHome />;
}
