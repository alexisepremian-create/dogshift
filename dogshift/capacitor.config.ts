import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor native app configuration — DogShift mode B (remote URL).
 *
 * The native app loads https://www.dogshift.ch directly in a WKWebView (iOS)
 * or WebView (Android), keeping SSR + 218 API routes intact. Apple-acceptable
 * because we ship native push notifications, Sign in with Apple, biometrics,
 * deep linking (Universal Links / App Links), and native splash screen.
 *
 * See docs/native-app.md for the full launch playbook.
 */
const config: CapacitorConfig = {
  appId: "ch.dogshift.app",
  appName: "DogShift",
  webDir: "capacitor-web-build",

  // Remote URL mode — loads the live production site in WebView.
  // The local webDir is only used as a fallback splash before the redirect.
  server: {
    url: "https://www.dogshift.ch",
    cleartext: false,
    // Allow our domain + Stripe checkout external windows.
    allowNavigation: [
      "www.dogshift.ch",
      "dogshift.ch",
      "*.stripe.com",
      "*.googleapis.com",
      "*.google.com",
    ],
  },

  ios: {
    contentInset: "always",
    // WebView background must match the in-app page (white) so the safe-area
    // zones around the WebView don't show purple bars at top/bottom when the
    // status bar / home indicator overlay. Purple is only used during splash.
    backgroundColor: "#ffffff",
    // Universal Links — the apple-app-site-association file must be served
    // at https://www.dogshift.ch/.well-known/apple-app-site-association
    scheme: "DogShift",
    limitsNavigationsToAppBoundDomains: false,
  },

  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#7c3aedff",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      // style: DARK means DARK content (icons/text) on a light background —
      // which is what we want now that the safe-area is white.
      style: "DARK",
      backgroundColor: "#ffffff",
    },
  },
};

export default config;
