"use client";
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";

import { useIsNativeApp } from "@/lib/native/useIsNativeApp";
import AuthFlow from "@/components/auth/AuthFlow";

const STORAGE_KEY = "ds_native_onboarding_v2";

// ---------------------------------------------------------------------------
// Illustration images — custom artwork placed in /public by the founder.
// ---------------------------------------------------------------------------
const ILLUSTRATION_SRCS = [
  "/app-2.png",  // Slide 1 — Le concept
  "/app-3.png",  // Slide 2 — La confiance
  "/app.png",    // Slide 3 — La réservation
] as const;

// ---------------------------------------------------------------------------
// Slide content
// ---------------------------------------------------------------------------

type Slide = { imgSrc: string; step: string; title: string; body: string };

const SLIDES: readonly Slide[] = [
  {
    imgSrc: ILLUSTRATION_SRCS[0],
    step: "01 · LE CONCEPT",
    title: "Votre chien mérite le meilleur.",
    body: "Trouvez rapidement un dogsitter de confiance près de chez vous pour les promenades, les gardes à domicile ou les séjours en pension.",
  },
  {
    imgSrc: ILLUSTRATION_SRCS[1],
    step: "02 · LA CONFIANCE",
    title: "Des dogsitters vérifiés.",
    body: "Chaque dogsitter est contrôlé avant d\u2019être publié. Profils vérifiés, expérience confirmée, casier judiciaire vierge et assurance RC pour garantir une garde fiable et sécurisée.",
  },
  {
    imgSrc: ILLUSTRATION_SRCS[2],
    step: "03 · LA RÉSERVATION",
    title: "Réservez en quelques secondes.",
    body: "Réservez votre dogsitter en quelques clics et gérez tout depuis une seule application.",
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
  const { status } = useSession();
  const [shouldShow, setShouldShow] = useState(false);
  const [index, setIndex] = useState(0);
  // Auth bottom-sheet (Airbnb-style). Opening it never navigates — AuthFlow is
  // rendered in-place over the onboarding's own white background, so the page
  // underneath (and its loading skeleton) is never revealed.
  const [authOpen, setAuthOpen] = useState(false);
  const [sheetRaised, setSheetRaised] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (!isNative) return;
    // Wait until the session is resolved before deciding — showing the intro
    // during "loading" then tearing it down causes a flash.
    if (status === "loading") return;
    // Already signed in → the app is unlocked, the onboarding/auth gate must
    // never appear (founder bug: "ya tjr le truc d'intro meme si je suis deja
    // connecté"). Mark it seen so it also won't pop on a later render.
    if (status === "authenticated") {
      markSeen();
      setShouldShow(false);
      return;
    }
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      return;
    }
    setShouldShow(true);
  }, [isNative, status, markSeen]);

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  // Open the auth sheet. If the user is somehow already signed in (e.g. a
  // returning user on a fresh install), skip auth and drop straight into the app.
  const openAuth = useCallback(() => {
    markSeen();
    if (status === "authenticated") {
      setShouldShow(false);
      return;
    }
    setAuthOpen(true);
    requestAnimationFrame(() => setSheetRaised(true));
  }, [markSeen, status]);

  const closeAuth = useCallback(() => {
    setSheetRaised(false);
    settleTimer.current = setTimeout(() => setAuthOpen(false), 320);
  }, []);

  // Once login/signup succeeds inside the sheet, the session flips to
  // "authenticated" — tear the whole overlay down so the app (or /post-login
  // redirect) shows through.
  useEffect(() => {
    if (authOpen && status === "authenticated") {
      markSeen();
      setShouldShow(false);
    }
  }, [authOpen, status, markSeen]);

  function next() {
    if (index >= SLIDES.length - 1) {
      openAuth();
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
        background: "#ffffff",
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
            DogShift
          </span>
        </div>
        <button
          type="button"
          onClick={openAuth}
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
        onScroll={() => {
          // Debounced: only update the active slide once scrolling settles.
          // Updating live (per scroll event) made the CTA label flip-flop
          // mid-swipe ("Continuer" ↔ "Créer mon compte") between slide 2 and 3.
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => {
            const el = scrollRef.current;
            if (!el) return;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }, 90);
        }}
      >
        {SLIDES.map((s, i) => (
          <section
            key={i}
            id={`ds-ob-slide-${i}`}
            className="flex w-full flex-shrink-0 snap-center flex-col"
          >
            {/* Illustration area — edge-to-edge, no borders */}
            <div
              className="overflow-hidden"
              style={{ height: "48vh" }}
            >
              <img
                src={s.imgSrc}
                alt=""
                className="h-full w-full object-cover"
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
            onClick={openAuth}
            className="font-semibold text-slate-900 underline underline-offset-2"
            style={{ touchAction: "manipulation" }}
          >
            Se connecter
          </button>
        </p>
      </div>

      {/* ── Auth bottom-sheet (slides up over the white onboarding) ── */}
      {authOpen ? (
        <div className="absolute inset-0 z-[10] flex flex-col justify-end">
          {/* Dim backdrop — taps close the sheet. Sits over the opaque white
              onboarding, so there is never a page skeleton behind it. */}
          <div
            className="absolute inset-0 bg-black/40 transition-opacity duration-300"
            style={{ opacity: sheetRaised ? 1 : 0 }}
            onClick={closeAuth}
          />

          {/* Sheet */}
          <div
            className="relative w-full rounded-t-[28px] bg-white px-6 pt-3 shadow-2xl transition-transform duration-300 ease-out"
            style={{
              transform: sheetRaised ? "translateY(0)" : "translateY(100%)",
              maxHeight: "94dvh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
            }}
          >
            {/* Grab handle */}
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />

            {/* Close */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeAuth}
                aria-label="Fermer"
                style={{ touchAction: "manipulation" }}
                className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:scale-95"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mx-auto w-full max-w-[420px] pb-2">
              <AuthFlow />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
