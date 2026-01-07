"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function PageTopOffset({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [scrolled, setScrolled] = useState(false);

  const isHostArea = Boolean(pathname && pathname.startsWith("/host"));
  const isAccountArea = Boolean(pathname && pathname.startsWith("/account"));
  const isHostPreview = Boolean(pathname && pathname.startsWith("/sitter/") && (searchParams?.get("mode") ?? "") === "preview");

  const needsOffset = useMemo(() => {
    if (!pathname) return false;
    if (pathname === "/") return false;
    if (isHostArea || isAccountArea || isHostPreview) return false;
    return true;
  }, [isAccountArea, isHostArea, isHostPreview, pathname]);

  useEffect(() => {
    if (!needsOffset) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [needsOffset]);

  const paddingTop = useMemo(() => {
    if (!needsOffset) return undefined;
    if (scrolled) return "var(--ds-page-top-offset)";
    return "120px";
  }, [needsOffset, scrolled]);

  if (!needsOffset) return <>{children}</>;

  return (
    <div className="transition-[padding] duration-200 ease-out" style={{ paddingTop }}>
      {children}
    </div>
  );
}
