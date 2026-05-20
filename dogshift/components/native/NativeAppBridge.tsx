"use client";

import { useNativeBridge } from "@/lib/native/capacitorBridge";

/**
 * Client-only component mounted in the root layout. Initializes the
 * Capacitor bridge when the app runs inside the native shell. No-op
 * on the public web.
 *
 * Renders nothing.
 */
export default function NativeAppBridge() {
  useNativeBridge();
  return null;
}
