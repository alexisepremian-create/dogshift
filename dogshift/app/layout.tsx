import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import SessionAuthProvider from "@/components/SessionAuthProvider";
import ConsentScriptLoader from "@/components/ConsentScriptLoader";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import InitialLoadSplash from "@/components/InitialLoadSplash";
import InstallPWAPrompt from "@/components/InstallPWAPrompt";
import NavigationOverlay from "@/components/NavigationOverlay";
import NavigationOverlayController from "@/components/NavigationOverlayController";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import WebOnly from "@/components/native/WebOnly";
import GlobalNativeBottomNav from "@/components/native/GlobalNativeBottomNav";
import NativeOnboarding from "@/components/native/NativeOnboarding";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#2f4d6b",
  width: "device-width",
  initialScale: 1,
  // `viewport-fit=cover` lets the rendered HTML viewport extend into the iOS
  // status-bar and home-indicator safe-area zones, which is necessary for the
  // native cold-launch splash overlay in app/globals.css to paint edge-to-edge
  // (otherwise the CSS pseudo-element on <html> is bounded by the
  // safe-area-respecting viewport and the zones show through as white bands).
  // Safe for web: every UI surface that touches a screen edge in this app
  // already uses `env(safe-area-inset-*)` for positioning (SiteHeader,
  // MobileBottomNav, ImpersonationBanner, dashboards, NativeMapHome…), so
  // content stays clear of the notch / home indicator on iOS Safari mobile.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.dogshift.ch"),
  title: {
    default: "DogShift – Dog-sitting premium en Suisse",
    template: "%s | DogShift",
  },
  description: "DogShift est une plateforme de dog-sitting premium en Suisse. Trouvez un dog-sitter de confiance pour promenade, garde ou pension.",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DogShift",
  },
  openGraph: {
    type: "website",
    url: "https://www.dogshift.ch",
    siteName: "DogShift",
    title: "DogShift – Dog-sitting premium en Suisse",
    description: "DogShift est une plateforme de dog-sitting premium en Suisse. Trouvez un dog-sitter de confiance pour promenade, garde ou pension.",
    locale: "fr_CH",
  },
  twitter: {
    card: "summary_large_image",
    title: "DogShift – Dog-sitting premium en Suisse",
    description: "DogShift est une plateforme de dog-sitting premium en Suisse. Trouvez un dog-sitter de confiance pour promenade, garde ou pension.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// Do NOT mark the root layout `force-dynamic`: it would override per-page
// `revalidate` (e.g. the homepage's `revalidate = 300`), forcing every request
// to re-render server-side and re-run Prisma queries. The post-login redirect
// flow does not need this — it's powered by:
//   1. /api/auth/resolve-redirect (route handler, dynamic via Auth.js auth())
//   2. /post-login & /login (client components driving navigation)
//   3. The proxy middleware in proxy.ts (cookie/session check per request)
// Removing `force-dynamic` here restores the static cache for the homepage
// and saves significant TTFB + hydration time on mobile.

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        {/* Capacitor early-detection — synchronous so it runs BEFORE the first
            paint of the WebView. Capacitor injects its bridge at
            `documentStart` (WKUserScript on iOS, equivalent on Android), so
            `window.Capacitor` is already defined when this inline script
            runs. Setting `data-native` on <html> at this point lets the CSS
            in globals.css hide the marketing footer + show a splash overlay
            BEFORE React hydrates and `useIsNativeApp()` flips. We also
            mirror to <body> (via RAF once it exists) and stamp
            `data-native-platform` (`ios` / `android`) for platform-specific
            hooks. Fixes the "header + footer with nothing in between" flash
            on cold launch (see docs/bugs/native-app-footer-flash-on-launch.md). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var c=window.Capacitor;if(c&&typeof c.isNativePlatform==='function'&&c.isNativePlatform()){var h=document.documentElement;h.setAttribute('data-native','true');var p=typeof c.getPlatform==='function'?c.getPlatform():'';if(p)h.setAttribute('data-native-platform',p);var apply=function(){if(document.body){document.body.setAttribute('data-native','true');if(p)document.body.setAttribute('data-native-platform',p);}else{requestAnimationFrame(apply);}};apply();}}catch(e){}})();",
          }}
        />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Persistent banner shown ONLY when an admin is impersonating another
            user. Server-rendered (no client-side flash). MUST stay at the very
            top of <body> so its `position: fixed` overlay sits above all other
            layers including modals + the Capacitor native bottom nav. */}
        <ImpersonationBanner />

        <Suspense fallback={null}>
          <SessionAuthProvider>
            {/* 3-screen welcome shown only the first time the Capacitor app is
                launched. Self-dismisses via localStorage; web users never see
                it. Lives INSIDE SessionAuthProvider because its auth bottom-sheet
                renders <AuthFlow /> (useSession + useSearchParams) in-place. */}
            <NativeOnboarding />

            {children}

            {/* Native-only bottom tab bar. Renders only inside the Capacitor
                shell, skipped on /host /account /admin (which have their own)
                and on auth micro-pages. Must live INSIDE SessionAuthProvider
                because it calls useSession(). */}
            <GlobalNativeBottomNav />
          </SessionAuthProvider>
        </Suspense>

        {/* Static overlay always present in the DOM — gets shown synchronously
            via a body[data-navigating="1"] attribute set in the click capture
            handler, masking the 1-frame gap before the new route's loading.tsx
            commits. */}
        <NavigationOverlay />
        <NavigationOverlayController />

        <InitialLoadSplash />

        {/* Cookie consent banner + Add-to-Home-Screen prompt — web-only,
            hidden inside the Capacitor native shell where cookies aren't
            tracked the same way and the user already installed the app. */}
        <WebOnly>
          <ConsentScriptLoader />
          <InstallPWAPrompt />
        </WebOnly>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
