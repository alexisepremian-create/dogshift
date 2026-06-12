"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

export default function PageTopOffset({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [scrolled, setScrolled] = useState(false);
  const isNative = useIsNativeApp();

  const isHostArea = Boolean(pathname && pathname.startsWith("/host"));
  const isAccountArea = Boolean(pathname && pathname.startsWith("/account"));
  const isHostPreview = Boolean(pathname && pathname.startsWith("/sitter/") && (searchParams?.get("mode") ?? "") === "preview");
  // Pages where we want the header to sit right above the content with no
  // extra breathing room (long form flows where vertical real estate matters).
  const isCompactPage = Boolean(
    pathname &&
      (pathname === "/devenir-dogsitter" ||
        pathname.startsWith("/devenir-dogsitter/") ||
        pathname.includes("/reservation") ||
        pathname.startsWith("/checkout/") ||
        pathname.startsWith("/sitter/")),
  );

  // Pages that take a top offset at all (not the home map, not the dashboards
  // which carry their own chrome, not the sitter preview).
  const baseApplies = Boolean(
    pathname &&
      pathname !== "/" &&
      !isHostArea &&
      !isAccountArea &&
      !isHostPreview,
  );

  // Web: the marketing SiteHeader is fixed, so content needs to clear it.
  const needsOffset = baseApplies && !isNative;

  // Native: the marketing SiteHeader is hidden, so the big 120px gap is wrong
  // (founder: "le texte est trop bas") — BUT with `viewport-fit=cover` +
  // `contentInset:never`, content at y=0 sits UNDER the iOS status-bar/notch.
  // So on native text/content pages we add just the safe-area inset (a few px),
  // never the full header offset. Hero/flow pages (sitter, checkout, devenir-
  // dogsitter, reservation) stay edge-to-edge — they manage their own top.
  const nativeTextTop = baseApplies && isNative && !isCompactPage;

  useEffect(() => {
    if (!needsOffset) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [needsOffset]);

  const paddingTop = useMemo(() => {
    if (nativeTextTop) return "calc(env(safe-area-inset-top, 0px) + 8px)";
    if (!needsOffset) return undefined;
    if (isCompactPage || scrolled) return "var(--ds-page-top-offset)";
    return "120px";
  }, [needsOffset, nativeTextTop, scrolled, isCompactPage]);

  if (!needsOffset && !nativeTextTop) return <>{children}</>;

  return (
    <div className="transition-[padding] duration-200 ease-out" style={{ paddingTop }}>
      {children}
    </div>
  );
}
