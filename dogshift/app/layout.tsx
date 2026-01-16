import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { headers } from "next/headers";
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
  title: "DogShift",
  description: "DogShift",
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
  const siteLockOn = process.env.NODE_ENV !== "production" && Boolean(process.env.SITE_PASSWORD);
  await headers();

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preload" as="image" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {siteLockOn ? (
          <div className="fixed left-3 top-3 z-[1000] rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 shadow-sm">
            SITE_LOCK=ON
          </div>
        ) : null}
        <ClerkProvider
          signInUrl="/login"
          signUpUrl="/signup"
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
