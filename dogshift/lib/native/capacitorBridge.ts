/**
 * Capacitor bridge — client-side wiring for the DogShift native app.
 *
 * Loaded only when the runtime is running inside the Capacitor shell
 * (detected via Capacitor.isNativePlatform()). On the public web site
 * this module is a no-op.
 *
 * Responsibilities :
 *  - Register for native push notifications (APNs / FCM) and post the token
 *    to /api/native/register-push-token.
 *  - Forward notification taps to the right URL (deep linking).
 *  - Style the native status bar to match the DogShift purple theme.
 *  - Hide the splash screen once the React app is interactive.
 *  - Open external links (Stripe checkout) in the system browser to avoid
 *    Apple's 30% in-app purchase rules.
 */

"use client";

import { useEffect } from "react";

let initialized = false;

export function useNativeBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialized) return;
    initialized = true;

    void initNativeBridge();
  }, []);
}

async function initNativeBridge() {
  let isNative = false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    isNative = Capacitor.isNativePlatform();
  } catch {
    return; // Capacitor not installed — running on plain web
  }
  if (!isNative) return;

  // ── Status bar (purple theme) ──────────────────────────────────────────
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#7c3aed" });
  } catch (err) {
    console.warn("[native] status-bar setup failed", err);
  }

  // ── Hide splash once React mounted ─────────────────────────────────────
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch (err) {
    console.warn("[native] splash-screen hide failed", err);
  }

  // ── Push notifications ─────────────────────────────────────────────────
  await setupPushNotifications();

  // ── Deep links (Universal Links / App Links) ───────────────────────────
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("appUrlOpen", (event) => {
      // event.url = "https://www.dogshift.ch/sitters/matilda"
      try {
        const u = new URL(event.url);
        // Strip origin → navigate within the WebView using SPA routing.
        const path = u.pathname + u.search + u.hash;
        window.location.assign(path);
      } catch {
        // Fallback : absolute navigation
        window.location.assign(event.url);
      }
    });
  } catch (err) {
    console.warn("[native] app deep-link listener failed", err);
  }
}

async function setupPushNotifications() {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // Ask permission
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      console.warn("[native][push] permission not granted", perm.receive);
      return;
    }

    // Register : triggers iOS to talk to APNs, Android to talk to FCM
    await PushNotifications.register();

    // Token received → POST to backend
    PushNotifications.addListener("registration", async (tokenData) => {
      let platform: "ios" | "android" = "ios";
      try {
        const { Capacitor } = await import("@capacitor/core");
        platform = Capacitor.getPlatform() === "android" ? "android" : "ios";
      } catch {
        // best-effort fallback
      }

      try {
        await fetch("/api/native/register-push-token", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            platform,
            token: tokenData.value,
            bundleId: "ch.dogshift.app",
          }),
        });
      } catch (err) {
        console.error("[native][push] failed to POST token to backend", err);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[native][push] registration error", err);
    });

    // Notification tapped → navigate to deep link
    PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
      const data = notification.notification.data as Record<string, unknown> | undefined;
      const url = typeof data?.url === "string" ? data.url : null;
      if (url) {
        try {
          const u = new URL(url, window.location.origin);
          window.location.assign(u.pathname + u.search + u.hash);
        } catch {
          // ignore
        }
      }
    });
  } catch (err) {
    console.warn("[native][push] setup failed", err);
  }
}

/**
 * Opens a URL in the system browser (Safari / Chrome) instead of the
 * in-app WebView. Critical for Stripe Checkout on iOS — Apple's App Store
 * guidelines forbid in-app payment for digital goods, and even for real
 * services they prefer external Safari.
 *
 * On the web (non-native) this is just a regular link click.
 */
export async function openExternalBrowser(url: string): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
