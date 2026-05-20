"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

/**
 * Detects whether the app is running inside the Capacitor native shell
 * (iOS/Android WebView) vs the public web (browser / PWA install).
 *
 * SSR-safe : returns `false` during server render and on first client paint
 * to avoid hydration mismatch. Flips to the real value on the next tick.
 *
 * Side effect : adds `data-native="true"` to <body> when native, so CSS can
 * target it cheaply (`body[data-native="true"] .web-only { display: none }`).
 *
 * Detection logic mirrors @capacitor/core's `Capacitor.isNativePlatform()`
 * without bundling the lib for plain web users — the global is only set
 * when running inside the shell.
 */
export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Capacitor injects `window.Capacitor` at runtime inside the WebView.
    // We avoid importing @capacitor/core here to keep the web bundle slim.
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const native = typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;

    setIsNative(native);

    if (native) {
      document.body.setAttribute("data-native", "true");
      // Get the platform too (ios | android) for finer-grained CSS targeting.
      const platform = (cap as unknown as { getPlatform?: () => string })?.getPlatform?.();
      if (platform) document.body.setAttribute("data-native-platform", platform);
    } else {
      document.body.removeAttribute("data-native");
      document.body.removeAttribute("data-native-platform");
    }
  }, []);

  return isNative;
}
