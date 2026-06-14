"use client";

import { useState } from "react";

/**
 * Synchronous native detection — reads the `data-native` attribute that the
 * boot script in app/layout.tsx sets on <html> BEFORE first paint.
 *
 * Unlike `useIsNativeApp()` (which returns false on the first render then flips
 * in an effect), this returns the correct value on the very first render, so a
 * component that branches its LAYOUT on native (e.g. the dashboard shell hiding
 * its logo header, RequestsSplitView dropping its card) doesn't paint the WEB
 * layout for a frame before flipping to native — that one-frame web layout was
 * a visible flash (founder bug).
 *
 * ⚠️ Use ONLY in components that render AFTER hydration — e.g. behind
 * HostHydrationGate / HostDataGate, which render a skeleton (not the shell)
 * during SSR + the first client render. For SSR-painted components keep
 * `useIsNativeApp()` to avoid a hydration mismatch (SSR=false vs client=true).
 */
export function useIsNativeAppSync(): boolean {
  const [isNative] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-native") === "true",
  );
  return isNative;
}
