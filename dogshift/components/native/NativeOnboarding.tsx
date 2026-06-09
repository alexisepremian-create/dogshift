"use client";
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

const STORAGE_KEY = "ds_native_onboarding_v2";

// ---------------------------------------------------------------------------
// Illustration images — custom artwork placed in /public by the founder.
// ---------------------------------------------------------------------------
const ILLUSTRATION_SRCS = [
  "/app.png",    // Person walking a happy dog
  "/app-2.png",  // Dog + shield/checkmark (verified)
  "/app-3.png",  // Hand holding phone with booking UI
] as const;

// ---------------------------------------------------------------------------
// Slide content
// ---------------------------------------------------------------------------

type Slide = { imgSrc: string; step: string; title: string; body: string };

const SLIDES: readonly Slide[] = [
  {
    imgSrc: ILLUSTRATION_SRCS[0],
    step: "01 · LE CONCEPT",
    title: "Le dogsitting,\nréinventé",
    body: "Trouve un dogsitter de confiance près de chez toi. Réserve en quelques clics, en toute sérénité.",
  },
  {
    imgSrc: ILLUSTRATION_SRCS[1],
    step: "02 · LA CONFIANCE",
    title: "100% vérifié",
    body: "Chaque dogsitter passe un entretien et une vérification d\u2019identité avant d\u2019être publié sur la plateforme.",
  },
  {
    imgSrc: ILLUSTRATION_SRCS[2],
    step: "03 · LA RÉSERVATION",
    title: "Réserve en\n3 clics",
    body: "Promenade, garde à domicile ou pension : choisis ton service, ton créneau, et c\u2019est parti.",
  },
] as const;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * 3-screen onboarding shown the first time the native Capacitor app is opened.
 * Inspired by iCompta's onboarding: illustration top, step label + bold title +
 * description bottom, dots + CTA + "Se connecter" link.
 *
 * **Auth gate**: all exit paths lead to /login or /signup. The app is not
 * accessible without an account.
 */
export default function NativeOnboarding() {
  const isNative = useIsNativeApp();
  const router = useRouter();
  const [shouldShow, setShouldShow] = useState(false);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNative) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      return;
    }
    setShouldShow(true);
  }, [isNative]);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // noop
    }
  }, []);

  const goSignup = useCallback(() => {
    markSeen();
    setShouldShow(false);
    router.push("/signup");
  }, [markSeen, router]);

  const goLogin = useCallback(() => {
    markSeen();
    setShouldShow(false);
    router.push("/login");
  }, [markSeen, router]);

  function next() {
    if (index >= SLIDES.length - 1) {
      goSignup();
      return;
    }
    const newIndex = index + 1;
    setIndex(newIndex);
    const el = document.getElementById(`ds-ob-slide-${newIndex}`);
    el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  if (!shouldShow) return null;

  const isLast = index === SLIDES.length - 1;

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "linear-gradient(180deg, #f8f7ff 0%, #f1f0fb 50%, #ffffff 50%)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding DogShift"
    >
      {/* ── Top bar : logo + "Passer" ── */}
      <div className="flex items-center justify-between px-5 pb-1 pt-3">
        <div className="flex items-center gap-2.5">
          <img
            src="/apple-touch-icon.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-[10px]"
          />
          <span className="text-[15px] font-bold tracking-tight text-slate-900">
            dogshift
          </span>
        </div>
        <button
          type="button"
          onClick={goLogin}
          style={{ touchAction: "manipulation" }}
          className="px-2 py-1.5 text-sm font-medium text-slate-400 active:scale-95"
        >
          Passer
        </button>
      </div>

      {/* ── Slides ── */}
      <div
        ref={scrollRef}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
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
            className="flex w-full flex-shrink-0 snap-center flex-col"
          >
            {/* Illustration area — edge-to-edge, image fills the space.
                Background matches the images' own beige (#f5f0ea) so
                they blend seamlessly with no visible border. */}
            <div
              className="flex items-center justify-center overflow-hidden"
              style={{ height: "48vh", background: "transparent" }}
            >
              <img
                src={s.imgSrc}
                alt=""
                className="h-full w-full object-contain"
                aria-hidden="true"
              />
            </div>

            {/* Content card (bottom half) — white rounded top */}
            <div
              className="flex-1 px-8 pb-2 pt-7"
              style={{
                background: "white",
                borderTopLeftRadius: "32px",
                borderTopRightRadius: "32px",
              }}
            >
              {/* Step label */}
              <p
                className="mb-3 text-center text-[12px] font-bold tracking-[0.18em]"
                style={{ color: "#7c3aed" }}
              >
                {s.step}
              </p>
              {/* Title */}
              <h2
                className="mb-3 text-center text-[28px] font-extrabold leading-[1.15] text-slate-900"
                style={{ whiteSpace: "pre-line" }}
              >
                {s.title}
              </h2>
              {/* Body */}
              <p className="mx-auto max-w-[300px] text-center text-[15px] leading-relaxed text-slate-500">
                {s.body}
              </p>
            </div>
          </section>
        ))}
      </div>

      {/* ── Bottom area: dots + CTA + login link ── */}
      <div
        className="px-6 pb-4 pt-4"
        style={{ background: "white" }}
      >
        {/* Dots */}
        <div className="mb-5 flex items-center justify-center gap-2" aria-hidden="true">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === index ? "24px" : "8px",
                height: "8px",
                background: i === index ? "#7c3aed" : "#d1d5db",
              }}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          type="button"
          onClick={next}
          style={{ touchAction: "manipulation" }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-[16px] font-semibold text-white shadow-lg active:scale-[0.98]"
        >
          {isLast ? "Créer mon compte" : "Continuer"}
          <span aria-hidden="true">{"\u2192"}</span>
        </button>

        {/* Login link */}
        <p className="mt-4 text-center text-[14px] text-slate-500">
          {"Vous avez déjà un compte ? "}
          <button
            type="button"
            onClick={goLogin}
            className="font-semibold text-slate-900 underline underline-offset-2"
            style={{ touchAction: "manipulation" }}
          >
            Se connecter
          </button>
        </p>
      </div>
    </div>
  );
}
