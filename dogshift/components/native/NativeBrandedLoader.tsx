"use client";

/**
 * Full-screen branded loading cover for the native app — pixel-identical to the
 * cold-launch splash (brand purple #7c3aed + the SAME `/native-splash.png`,
 * `background-size: cover`). Used to mask the logout/login transitions so the
 * user sees ONE continuous branded screen until the destination is ready, with
 * zero seam against the launch splash.
 *
 * NB: it renders the splash image as a `cover` background (not a fixed-size
 * <img>) so the logo keeps its aspect ratio. The previous version forced the
 * 1024×1280 paw PNG into a 92×92 square, which squished the logo (founder: "le
 * logo est compressé comme ça quand je me déconnecte/reconnecte").
 */
export default function NativeBrandedLoader({ fadeOut = false }: { fadeOut?: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        // Just below the cold-launch splash (2147483647) so that still wins,
        // but above every app layer (headers z-70, bottom nav, modals).
        zIndex: 2147483646,
        background: "#7c3aed",
        transition: "opacity 380ms ease",
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? "none" : "auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: 'url("/native-splash.png")',
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          animation: "brandPulseSubtle 1.6s ease-in-out infinite",
          willChange: "opacity",
        }}
      />
    </div>
  );
}
