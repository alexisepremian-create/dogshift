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

  // ── Status bar (white theme — matches the in-app page background) ─────
  // We deliberately use a white status bar (dark icons on white) instead of
  // purple so the safe-area at the top doesn't paint a coloured band over the
  // content. Purple only appears during the launch splash.
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#ffffff" });
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

  // ── Reveal the WebView ─────────────────────────────────────────────────
  // The inline <head> script in app/layout.tsx painted a purple overlay (CSS
  // ::before pseudo-element on <html>, same colour as the native launch
  // screen) to hide the SSR-streamed marketing layout from the user during
  // the WebView's initial paint + React hydration window. Once we get here
  // the React tree has hydrated and NativeHomeSwitch has flipped to
  // NativeMapHome, so it's safe to fade the overlay out and reveal the
  // native UI. See docs/bugs/native-app-footer-flash-on-launch.md.
  try {
    document.documentElement.setAttribute("data-native-ready", "true");
  } catch (err) {
    console.warn("[native] data-native-ready flip failed", err);
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

    // DO NOT auto-prompt at boot — that's the App Store reject + UX anti-pattern.
    // Only register listeners here ; the actual `requestPermissions()` call is
    // exposed via `requestNativePushPermission()` below and must be triggered
    // by a user action (e.g. "Activer les notifications" button in account
    // settings, or right after creating a booking).
    //
    // If the user has already granted permission in a previous session,
    // checkPermissions() will return "granted" and we proceed to register.
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      // Not granted yet — wait for the user to opt-in via the UI.
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
 * Prompts the user for push notification permission and registers with
 * APNs/FCM if granted. Must be called from a user action (button click)
 * to avoid the cold-boot popup which looks like spam and triggers
 * App Store reject (guideline 4.5.4).
 *
 * Returns `true` if permission was granted (or already granted), `false`
 * otherwise. No-op on web.
 */
export async function requestNativePushPermission(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return false;
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return false;
    await PushNotifications.register();
    return true;
  } catch (err) {
    console.warn("[native][push] requestNativePushPermission failed", err);
    return false;
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
