"use client";

import { useEffect, useState } from "react";

/**
 * Current on-screen keyboard height in CSS pixels (0 when hidden).
 *
 * On the native app Capacitor runs with `Keyboard.resize: "none"` (the search
 * panel needs it), so the WebView does NOT resize when the keyboard opens AND
 * `visualViewport` does not report the keyboard on iOS in that mode. We read the
 * real height from the Capacitor Keyboard plugin's willShow/willHide events.
 * Web (and any non-native context) falls back to `visualViewport`.
 *
 * Use it to lift text inputs above the keyboard (chat composer, etc.).
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const removers: Array<() => void> = [];

    void (async () => {
      // Native: Capacitor Keyboard plugin — reports the exact height.
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { Keyboard } = await import("@capacitor/keyboard");
          const show = await Keyboard.addListener("keyboardWillShow", (info) => {
            if (!cancelled) setHeight(Math.max(0, Math.round(info.keyboardHeight || 0)));
          });
          const hide = await Keyboard.addListener("keyboardWillHide", () => {
            if (!cancelled) setHeight(0);
          });
          if (cancelled) {
            void show.remove();
            void hide.remove();
            return;
          }
          removers.push(() => void show.remove(), () => void hide.remove());
          return;
        }
      } catch {
        // not native / plugin unavailable → fall through to visualViewport
      }

      // Web fallback.
      if (typeof window === "undefined" || !window.visualViewport) return;
      const vv = window.visualViewport;
      const onResize = () => {
        if (!cancelled) setHeight(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
      };
      vv.addEventListener("resize", onResize);
      vv.addEventListener("scroll", onResize);
      onResize();
      removers.push(
        () => vv.removeEventListener("resize", onResize),
        () => vv.removeEventListener("scroll", onResize),
      );
    })();

    return () => {
      cancelled = true;
      removers.forEach((r) => r());
    };
  }, []);

  return height;
}
