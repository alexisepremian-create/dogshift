import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import SessionAuthProvider from "@/components/SessionAuthProvider";
import ConsentScriptLoader from "@/components/ConsentScriptLoader";
import InitialLoadSplash from "@/components/InitialLoadSplash";
import InstallPWAPrompt from "@/components/InstallPWAPrompt";
import NavigationOverlay from "@/components/NavigationOverlay";
import NavigationOverlayController from "@/components/NavigationOverlayController";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import WebOnly from "@/components/native/WebOnly";
import GlobalNativeBottomNav from "@/components/native/GlobalNativeBottomNav";
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
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense fallback={null}>
          <SessionAuthProvider>
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
