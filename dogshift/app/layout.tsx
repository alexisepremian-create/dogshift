import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import SessionAuthProvider from "@/components/SessionAuthProvider";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preload" as="image" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider
          signInUrl="/login"
          signUpUrl="/login"
          afterSignInUrl="/post-login"
          afterSignUpUrl="/post-login"
          localization={frFR}
        >
          <Suspense fallback={null}>
            <SessionAuthProvider>{children}</SessionAuthProvider>
          </Suspense>
        </ClerkProvider>
      </body>
    </html>
  );
}
