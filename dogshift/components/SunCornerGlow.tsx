import React from "react";

export type SunCornerGlowVariant =
  | "ownerDashboard"
  | "ownerBookings"
  | "ownerMessages"
  | "ownerSettings"
  | "sitterDashboard"
  | "sitterRequests"
  | "sitterMessages"
  | "sitterProfile"
  | "sitterSettings"
  | "sitterPublicPreview";

const MASK = "linear-gradient(to bottom, rgba(0,0,0,1) 0px, rgba(0,0,0,1) 170px, rgba(0,0,0,0) 320px)";

function colorsForVariant(variant: SunCornerGlowVariant) {
  if (variant) {
    return { core: "rgba(250,204,21,0.78)", glow: "rgba(250,204,21,0.26)" };
  }
  return { core: "rgba(250,204,21,0.78)", glow: "rgba(250,204,21,0.26)" };
}

export default function SunCornerGlow({
  variant,
  intensity = 1,
}: {
  variant: SunCornerGlowVariant;
  intensity?: number;
}) {
  const { core, glow } = colorsForVariant(variant);

  const coreOpacity = Math.max(0, Math.min(1.15, 0.95 * intensity + 0.2));
  const raysOpacity = Math.max(0, Math.min(0.42, 0.34 * intensity));
  const raysBlurOpacity = Math.max(0, Math.min(0.20, 0.16 * intensity));
  const rayColor = "rgba(251, 146, 60, 0.95)";
  const raySoftColor = "rgba(250, 204, 21, 0.65)";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
      style={{
        maskImage: MASK,
        WebkitMaskImage: MASK,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 100% 0%, ${core} 0%, rgba(255,255,255,0.86) 13%, rgba(255,255,255,0.30) 22%, rgba(255,255,255,0.0) 46%)`,
          opacity: coreOpacity,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 100% 0%, ${glow} 0%, rgba(250,204,21,0.14) 18%, rgba(250,204,21,0.0) 56%)`,
          filter: "blur(54px)",
          opacity: coreOpacity,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: `repeating-conic-gradient(from 315deg at 100% 0%, rgba(255,255,255,0) 0deg 4.6deg, ${raySoftColor} 4.6deg 5.2deg)`,
          opacity: raysBlurOpacity,
          filter: "blur(14px)",
          mixBlendMode: "soft-light",
          maskImage: "radial-gradient(circle at 100% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.65) 22%, rgba(0,0,0,0) 54%)",
          WebkitMaskImage: "radial-gradient(circle at 100% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.65) 22%, rgba(0,0,0,0) 54%)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: `repeating-conic-gradient(from 315deg at 100% 0%, rgba(255,255,255,0) 0deg 6.6deg, ${rayColor} 6.6deg 7.4deg)`,
          opacity: raysOpacity,
          mixBlendMode: "normal",
          maskImage: "radial-gradient(circle at 100% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.70) 24%, rgba(0,0,0,0) 56%)",
          WebkitMaskImage: "radial-gradient(circle at 100% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.70) 24%, rgba(0,0,0,0) 56%)",
        }}
      />
    </div>
  );
}
