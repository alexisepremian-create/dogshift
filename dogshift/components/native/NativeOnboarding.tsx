"use client";
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useEffect, useState, type ReactNode } from "react";

import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

const STORAGE_KEY = "ds_native_onboarding_v1";

// SVG icons inlined so they pick up the slide's accent colour via currentColor
// — no extra fetch, no flicker, and the gradient ring stays consistent across
// all three screens.
function LogoVisual() {
  return (
    <img
      src="/dogshift-logo.svg"
      alt="DogShift"
      width={96}
      height={96}
      className="drop-shadow-[0_8px_20px_rgba(124,58,237,0.35)]"
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
  accent: string;
  /** True = a flat coloured circle with white-tinted icon. False = white circle (used for the logo). */
  filled: boolean;
};

const SLIDES: readonly Slide[] = [
  {
    visual: <LogoVisual />,
    title: "Bienvenue sur DogShift",
    body: "Trouve un dogsitter de confiance près de chez toi, en quelques secondes.",
    accent: "#7c3aed",
    filled: false,
  },
  {
    visual: <ShieldCheckIcon />,
    title: "Des profils vérifiés",
    body: "Tous les dogsitters DogShift passent une vérification d'identité et un entretien.",
    accent: "#0891b2",
    filled: true,
  },
  {
    visual: <BoltIcon />,
    title: "Réserve en 3 taps",
    body: "Promenade, garde à domicile ou pension : choisis ton service, ton horaire, et c'est parti.",
    accent: "#2f4d6b",
    filled: true,
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
    if (index >= SLIDES.length - 1) {
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
        {SLIDES.map((s, i) => (
          <section
            key={i}
            id={`ds-ob-slide-${i}`}
            className="flex w-full flex-shrink-0 snap-center flex-col items-center justify-center px-8 text-center"
          >
            <div
              className="mb-8 flex h-36 w-36 items-center justify-center rounded-full shadow-[0_20px_50px_-20px_rgba(2,6,23,0.35)]"
              style={
                s.filled
                  ? {
                      background: `linear-gradient(135deg, ${s.accent} 0%, ${s.accent}cc 100%)`,
                      color: "#ffffff",
                    }
                  : { background: "#ffffff", border: "1px solid rgba(124,58,237,0.18)" }
              }
              aria-hidden="true"
            >
              {s.visual}
            </div>
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
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={
                i === index
                  ? "h-2 w-8 rounded-full bg-[var(--dogshift-blue)] transition-all"
                  : "h-2 w-2 rounded-full bg-slate-300 transition-all"
              }
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          style={{ touchAction: "manipulation" }}
          className="rounded-full bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(47,77,107,0.6)] active:scale-95"
        >
          {index === SLIDES.length - 1 ? "Commencer" : "Suivant"}
        </button>
      </div>
    </div>
  );
}
