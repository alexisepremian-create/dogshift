"use client";

import BrandedSplashLogo from "@/components/native/BrandedSplashLogo";

/**
 * Full-screen branded cover for the /sign-out page's own (client-nav) frame —
 * purple + the inline-SVG logo (same as #ds-auth-splash), so it paints instantly
 * with no PNG decode gap and matches the splash exactly. The global
 * #ds-auth-splash covers the hard-nav reloads; this just covers /sign-out before
 * its effect sets the flag.
 */
export default function NativeBrandedLoader({ fadeOut = false }: { fadeOut?: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483646,
        background: "#7c3aed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 380ms ease",
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? "none" : "auto",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <BrandedSplashLogo />
    </div>
  );
}
