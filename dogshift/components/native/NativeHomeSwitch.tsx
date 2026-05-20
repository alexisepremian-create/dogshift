"use client";

import { useIsNativeApp } from "@/lib/native/useIsNativeApp";
import NativeMapHome from "@/components/native/NativeMapHome";

/**
 * Client-side switch : renders the full-screen native map home when running
 * inside the Capacitor shell, otherwise lets the existing marketing homepage
 * (children) render unchanged.
 *
 * The marketing home is heavy (testimonials, FAQ, big-text hero) — that's
 * great for SEO + conversion on the web but wrong for an app's first screen.
 * Native users land on the map directly.
 */
export default function NativeHomeSwitch({ children }: { children: React.ReactNode }) {
  const isNative = useIsNativeApp();
  if (isNative) return <NativeMapHome />;
  return <>{children}</>;
}
