"use client";
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useEffect, useState, type ReactNode } from "react";

import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

const STORAGE_KEY = "ds_native_onboarding_v1";

// Slide 1 = the actual app icon (public/apple-touch-icon.png) clipped to a
// perfect circle. Founder feedback : "le logo c'est apple-touch-icon.png dans
// le fichier public c'est ca que tu dois mettre" + "les icones doivent etre
// rondes pas carrés a bords arrondis". The Apple icon is itself a rounded
// square purple+paw; clipping to a full circle gives a clean ring around the
// paw — no white outer ring, no rounded-square edges, just one round mark.
function AppIcon() {
  return (
    <img
      src="/apple-touch-icon.png"
      alt="DogShift"
      width={144}
      height={144}
      className="h-36 w-36 rounded-full object-cover"
    />
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4.5 13.5h7L11 22l8.5-11.5h-7L13 2z" />
    </svg>
  );
}

type Slide = {
  visual: ReactNode;
  title: string;
  body: string;
};

// All 3 circles share the same purple as the app icon (#7c3aed). Variety is
// in the SVG inside (paw / shield / bolt), not the colour.
type Slide2 = Slide & { ringed: boolean };

// Slide 1 already IS the full app icon (no extra ring needed). Slides 2 + 3
// use the same purple ring as the icon background, with a white inline SVG
// inside. All 3 are PERFECT CIRCLES (rounded-full, no rounded-square corners).
const SLIDES_V2: readonly Slide2[] = [
  {
    visual: <AppIcon />,
    title: "Bienvenue sur DogShift",
    body: "Trouve un dogsitter de confiance près de chez toi, en quelques secondes.",
    ringed: false,
  },
  {
    visual: <ShieldCheckIcon />,
    title: "Des profils vérifiés",
    body: "Tous les dogsitters DogShift passent une vérification d'identité et un entretien.",
    ringed: true,
  },
  {
    visual: <BoltIcon />,
    title: "Réserve en 3 taps",
    body: "Promenade, garde à domicile ou pension : choisis ton service, ton horaire, et c'est parti.",
    ringed: true,
  },
] as const;

/**
 * 3-screen onboarding shown ONLY the first time the app is opened inside the
 * Capacitor shell. We persist completion in localStorage so it never reappears
 * on subsequent launches. Web users never see this.
 *
 * Implementation : horizontal scroll-snap container, no Swiper library
 * (one less dep, native-feeling on iOS). The bottom-right CTA changes
 * meaning as the user advances : "Suivant" → "Suivant" → "Commencer".
 */
export default function NativeOnboarding() {
  const isNative = useIsNativeApp();
  const [shouldShow, setShouldShow] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isNative) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // Cookies / storage blocked — silently skip.
      return;
    }
    setShouldShow(true);
  }, [isNative]);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // noop — best effort
    }
    setShouldShow(false);
  }

  function next() {
    if (index >= SLIDES_V2.length - 1) {
      dismiss();
      return;
    }
    const newIndex = index + 1;
    setIndex(newIndex);
    const el = document.getElementById(`ds-ob-slide-${newIndex}`);
    el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-white"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding DogShift"
    >
      {/* Skip link top-right (always reachable) */}
      <div className="flex items-center justify-end px-4 pt-3">
        <button
          type="button"
          onClick={dismiss}
          style={{ touchAction: "manipulation" }}
          className="text-sm font-medium text-slate-500 active:scale-95"
        >
          Passer
        </button>
      </div>

      {/* Slides — horizontal scroll-snap (no JS swiper lib needed) */}
      <div
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth"
        onScroll={(e) => {
          const x = e.currentTarget.scrollLeft;
          const w = e.currentTarget.clientWidth;
          setIndex(Math.round(x / w));
        }}
      >
        {SLIDES_V2.map((s, i) => (
          <section
            key={i}
            id={`ds-ob-slide-${i}`}
            className="flex w-full flex-shrink-0 snap-center flex-col items-center justify-center px-8 text-center"
          >
            {s.ringed ? (
              <div
                className="mb-8 flex h-36 w-36 items-center justify-center rounded-full text-white shadow-[0_20px_50px_-20px_rgba(124,58,237,0.55)]"
                style={{
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                }}
                aria-hidden="true"
              >
                {s.visual}
              </div>
            ) : (
              <div
                className="mb-8 shadow-[0_20px_50px_-20px_rgba(124,58,237,0.55)] rounded-full"
                aria-hidden="true"
              >
                {s.visual}
              </div>
            )}
            <h2 className="mb-3 text-balance text-2xl font-bold text-slate-900">{s.title}</h2>
            <p className="max-w-sm text-balance text-base leading-relaxed text-slate-600">
              {s.body}
            </p>
          </section>
        ))}
      </div>

      {/* Dots indicator + CTA */}
      <div className="flex items-center justify-between gap-4 px-6 pb-6 pt-4">
        <div className="flex items-center gap-2" aria-hidden="true">
          {SLIDES_V2.map((_, i) => (
            <div
              key={i}
              className={
                i === index
                  ? "h-2 w-8 rounded-full bg-[#7c3aed] transition-all"
                  : "h-2 w-2 rounded-full bg-slate-300 transition-all"
              }
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          style={{ touchAction: "manipulation" }}
          className="rounded-full bg-[#7c3aed] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(124,58,237,0.6)] active:scale-95 hover:bg-[#6d28d9]"
        >
          {index === SLIDES_V2.length - 1 ? "Commencer" : "Suivant"}
        </button>
      </div>
    </div>
  );
}
