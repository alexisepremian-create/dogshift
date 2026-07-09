"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useIsNativeApp } from "@/lib/native/useIsNativeApp";
import { useIsNativeAppSync } from "@/lib/native/useIsNativeAppSync";
import NativeMapHome from "@/components/native/NativeMapHome";

// Slate backdrop matching NativeMapHome's root (bg-slate-100) + MapHomeSkeleton,
// so the brief gaps below never paint a white body (the "flash when tapping
// Accueil"). fixed inset-0 z-0 sits under the bottom nav.
function NativeHomeBackdrop() {
  return <div className="fixed inset-0 z-0 bg-slate-100" aria-hidden="true" />;
}

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
  // Synchronous read of `data-native` — correct on the very FIRST client render
  // (unlike useIsNativeApp, which is false for one frame). Used only to paint a
  // slate backdrop during the gaps below, never to swap SSR content.
  const isNativeSync = useIsNativeAppSync();
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
      <>
        {/* Native only: fill the one-frame gap (before useIsNativeApp confirms
            native and NativeMapHome mounts) with the slate backdrop so the body
            never flashes white when tapping Accueil. On web this renders nothing. */}
        {isNativeSync ? <NativeHomeBackdrop /> : null}
        <div data-ds-web-home style={{ display: "contents" }}>
          {children}
        </div>
      </>
    );
  }

  // While session is loading / redirect is firing: slate backdrop (never a blank
  // white body). The cold-launch splash still covers the very first load.
  if (status === "loading") return <NativeHomeBackdrop />;
  if (status === "unauthenticated") return <NativeHomeBackdrop />;

  return <NativeMapHome />;
}
