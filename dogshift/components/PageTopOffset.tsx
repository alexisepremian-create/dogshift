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

  const needsOffset = useMemo(() => {
    if (!pathname) return false;
    if (pathname === "/") return false;
    if (isHostArea || isAccountArea || isHostPreview) return false;
    // In the Capacitor shell the marketing SiteHeader is hidden — adding the
    // 120px top offset just leaves a huge blank gap above text pages (CGU,
    // confidentialité, mentions, …). Founder feedback : "le texte est trop
    // bas faut le monter bcp plus haut".
    if (isNative) return false;
    return true;
  }, [isAccountArea, isHostArea, isHostPreview, isNative, pathname]);

  useEffect(() => {
    if (!needsOffset) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [needsOffset]);

  const paddingTop = useMemo(() => {
    if (!needsOffset) return undefined;
    if (isCompactPage || scrolled) return "var(--ds-page-top-offset)";
    return "120px";
  }, [needsOffset, scrolled, isCompactPage]);

  if (!needsOffset) return <>{children}</>;

  return (
    <div className="transition-[padding] duration-200 ease-out" style={{ paddingTop }}>
      {children}
    </div>
  );
}
