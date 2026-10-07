"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { getConsentCookie, type ConsentLevel } from "@/lib/cookieConsent";
import { analyticsConfigured, enableFunnel, trackFunnel } from "@/lib/analytics/funnel";
import CookieBanner from "./CookieBanner";

export default function ConsentScriptLoader() {
  const [consented, setConsented] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    setConsented(getConsentCookie() === "all"); // eslint-disable-line react-hooks/set-state-in-effect -- read browser cookie after hydration
  }, []);
  useEffect(() => {
    if (!consented || !enableFunnel()) return;
    trackFunnel("visit", "session");
    if (/^\/sitter\/[^/]+\/?$/.test(pathname)) trackFunnel("sitter_view", pathname);
  }, [pathname, consented]);
  function handleConsent(level: ConsentLevel) { setConsented(level === "all"); }
  return <>
    <CookieBanner onConsent={handleConsent} />
    {consented && analyticsConfigured() && <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />}
  </>;
}
