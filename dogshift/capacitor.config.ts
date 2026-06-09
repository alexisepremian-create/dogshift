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

  // Append "DogShiftApp/Capacitor" to the WKWebView User-Agent so
  // the Cloudflare WAF skip rule (UA contains "Capacitor") matches
  // and the bot challenge page is never shown inside the app.
  appendUserAgent: "DogShiftApp/Capacitor",

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
    // `never` (was "always") — let the WKWebView extend edge-to-edge under
    // status bar + home indicator. With `viewport-fit=cover` + page-level
    // env(safe-area-inset-*) usage (SiteHeader, MobileBottomNav, etc.), this
    // is the modern iOS pattern. `always` reduced 100vh by the inset values,
    // which made the in-WebView splash overlay scale ~9% smaller than the
    // native LaunchScreen (founder bug : "il devient plus petit avant le
    // lancement de l'animation"). Switching to `never` aligns the layout
    // viewport with the device screen so background-size: cover matches
    // scaleAspectFill exactly.
    contentInset: "never",
    // WebView background = brand purple. The safe-area zones around the WebView
    // (status-bar at top, home-indicator at bottom) previously showed white
    // bands during the splash → app handoff because the WebView's own bg was
    // white. Painting it #7c3aed here means even before the body's bg rule
    // applies (or if `viewport-fit=cover` ever fails), the user sees brand
    // purple in those zones — never a white band. After the splash animation
    // finishes, individual pages can paint over with their own bg
    // (NativeMapHome → slate-100, login form card → white, etc.).
    backgroundColor: "#7c3aed",
    // Universal Links — the apple-app-site-association file must be served
    // at https://www.dogshift.ch/.well-known/apple-app-site-association
    scheme: "DogShift",
    limitsNavigationsToAppBoundDomains: false,
  },

  android: {
    backgroundColor: "#7c3aed",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    // Native launch splash — purple background + white DogShift logo (generated
    // by `node scripts/generate-native-splash.mjs`). Stays visible until the
    // bridge in `lib/native/capacitorBridge.ts` calls `SplashScreen.hide()`
    // after React hydration + NativeMapHome mount. The 30 s `launchShowDuration`
    // is a SAFETY NET only — covers the worst-case Neon cold start + slow
    // device hydration window. In normal operation the splash hides in
    // 1-3 s as soon as the bridge init resolves.
    //
    // We keep `launchAutoHide: true` (vs. false) so a catastrophic JS load
    // failure (offline, syntax error before bridge mounts) still drops the
    // splash within 30 s — the user can then see the WebView and react,
    // instead of being stuck on a frozen splash forever.
    //
    // The CSS overlay in `app/globals.css` (html[data-native]::before) takes
    // over from the native splash without a colour seam — both are exactly
    // #7c3aed, so the transition is invisible.
    SplashScreen: {
      launchShowDuration: 30000,
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
      // style: LIGHT = light content (white icons/text) on the DARK purple
      // background. Matches the WebView bg (#7c3aed) so the status-bar zone
      // is one seamless purple band with white time/battery icons.
      style: "LIGHT",
      backgroundColor: "#7c3aed",
    },
    Keyboard: {
      // `resize: "none"` — iOS keyboard appears WITHOUT resizing the WebView.
      // Required because our search panel uses position:fixed (top-anchored).
      // With the default "native" mode, iOS tries to shrink the WebView when
      // the keyboard appears, which trips the WKWebView's focus auto-scroll
      // logic and the keyboard ends up not showing at all on the Lieu input
      // (founder bug : "le clavier ne sort toujours pas snif"). `none` means
      // the app is responsible for its own keyboard avoidance — fine here
      // because the panel scrolls internally.
      resize: "none",
      resizeOnFullScreen: false,
    },
  },
};

export default config;
