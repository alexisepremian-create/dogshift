"use client";
/* eslint-disable @next/next/no-img-element */

/**
 * Full-screen branded loading cover for the native app — brand purple
 * (#7c3aed) + the white DogShift paw, matching the launch splash. Used to mask
 * the post-login transition so the user never sees a white skeleton or a
 * jarring multi-step sequence — just one continuous branded screen until the
 * destination is ready.
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
      <img
        src="/dogshift-paw-white.png"
        alt=""
        width={92}
        height={92}
        style={{
          width: 92,
          height: 92,
          animation: "dsBrandedPawPulse 1.3s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
}
