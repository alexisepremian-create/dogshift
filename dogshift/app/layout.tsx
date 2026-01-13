import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import DogShiftBot from "@/components/DogShiftBot";
import PageTopOffset from "@/components/PageTopOffset";
import SessionAuthProvider from "@/components/SessionAuthProvider";
import SiteHeader from "@/components/SiteHeader";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const pathname = h.get("x-dogshift-pathname") ?? "";
  const isAccess = pathname === "/access";
  const siteLockOn = process.env.NODE_ENV !== "production" && Boolean(process.env.SITE_PASSWORD);

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
          afterSignInUrl="/account"
          afterSignUpUrl="/account"
          localization={frFR}
        >
          <Suspense fallback={null}>
            <SessionAuthProvider>
              {isAccess ? children : <SiteHeader />}
              {isAccess ? null : <PageTopOffset>{children}</PageTopOffset>}
              {isAccess ? null : <DogShiftBot />}
            </SessionAuthProvider>
          </Suspense>
          {isAccess ? null : (
            <footer className="border-t border-slate-200/70 bg-white">
              <div className="flex w-full flex-col gap-3 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-start sm:px-6">
                <div className="flex items-start gap-4">
                  <Link href="/" aria-label="DogShift" className="inline-flex items-center">
                    <Image
                      src="/dogshift-logo.png"
                      alt="DogShift"
                      width={240}
                      height={56}
                      className="h-[52px] w-auto"
                      priority={false}
                    />
                  </Link>
                  <div className="flex flex-col items-start gap-1 pt-1">
                    <Link
                      href="/cgu"
                      className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]"
                    >
                      CGU
                    </Link>
                    <p className="font-medium text-slate-700">© {new Date().getFullYear()} DogShift</p>
                  </div>
                </div>
              </div>
            </footer>
          )}
        </ClerkProvider>
      </body>
    </html>
  );
}
