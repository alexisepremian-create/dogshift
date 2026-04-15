"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

import { getConsentCookie, type ConsentLevel } from "@/lib/cookieConsent";
import CookieBanner from "./CookieBanner";

const GA_ID = "AW-18081650051";

/**
 * Manages cookie consent banner + conditional loading of Google Ads.
 * Rendered client-side so it never blocks the server render.
 */
export default function ConsentScriptLoader() {
  const [adsConsented, setAdsConsented] = useState(false);

  useEffect(() => {
    // Check existing consent on mount
    const level = getConsentCookie();
    if (level === "all") setAdsConsented(true);
  }, []);

  function handleConsent(level: ConsentLevel) {
    if (level === "all") setAdsConsented(true);
  }

  return (
    <>
      <CookieBanner onConsent={handleConsent} />

      {adsConsented && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-ads-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}
    </>
  );
}
