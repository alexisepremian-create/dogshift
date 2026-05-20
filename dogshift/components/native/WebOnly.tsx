"use client";

import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

/**
 * Renders children only when the app is NOT running inside the Capacitor
 * native shell (i.e. plain web / PWA install). On native iOS/Android, the
 * children are not mounted at all — useful for cookie banners, "Add to home
 * screen" prompts, and other web-only widgets that would feel out of place
 * (or violate Apple guidelines) inside a real native app.
 *
 * SSR-safe : the hook returns `false` on first paint then flips to the real
 * value, so the children render briefly on the server / first hydration tick
 * before disappearing if we're native. Acceptable trade-off — avoids the
 * hydration mismatch warning that would come from a layout effect approach.
 */
export default function WebOnly({ children }: { children: React.ReactNode }) {
  const isNative = useIsNativeApp();
  if (isNative) return null;
  return <>{children}</>;
}

/**
 * Inverse : renders children only inside the native shell.
 * Used for native-only UI like the bottom tab bar.
 */
export function NativeOnly({ children }: { children: React.ReactNode }) {
  const isNative = useIsNativeApp();
  if (!isNative) return null;
  return <>{children}</>;
}
