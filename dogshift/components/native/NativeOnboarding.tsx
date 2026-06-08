"use client";
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useIsNativeApp } from "@/lib/native/useIsNativeApp";

const STORAGE_KEY = "ds_native_onboarding_v2";

// ---------------------------------------------------------------------------
// Cartoon-style SVG illustrations — playful line-art + soft fills
// Inspired by the DogShift Instagram visual identity (purple accent, rounded
// shapes, friendly dog motifs).
// ---------------------------------------------------------------------------

/** Slide 1 — Person walking a happy dog */
function IllustrationWalkDog() {
  return (
    <svg viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[280px]" aria-hidden="true">
      {/* Ground line */}
      <ellipse cx="160" cy="262" rx="140" ry="8" fill="#f1f5f9" />

      {/* Dog body */}
      <ellipse cx="115" cy="210" rx="42" ry="28" fill="#fcd34d" />
      {/* Dog head */}
      <circle cx="148" cy="182" r="22" fill="#fbbf24" />
      {/* Dog ear */}
      <ellipse cx="162" cy="170" rx="10" ry="14" fill="#f59e0b" transform="rotate(20 162 170)" />
      {/* Dog eye */}
      <circle cx="153" cy="179" r="3" fill="#1e293b" />
      {/* Dog nose */}
      <ellipse cx="166" cy="186" rx="4" ry="3" fill="#1e293b" />
      {/* Dog mouth (happy) */}
      <path d="M158 190 Q163 196 168 190" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Dog tail (wagging) */}
      <path d="M73 195 Q58 170 68 155" stroke="#f59e0b" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Dog legs */}
      <line x1="95" y1="232" x2="90" y2="258" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
      <line x1="110" y1="235" x2="108" y2="258" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
      <line x1="128" y1="235" x2="130" y2="258" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
      <line x1="140" y1="232" x2="145" y2="258" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
      {/* Dog collar */}
      <rect x="136" y="196" width="24" height="5" rx="2.5" fill="#7c3aed" />

      {/* Leash */}
      <path d="M148 200 Q170 210 195 175" stroke="#7c3aed" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="0" />

      {/* Person */}
      {/* Head */}
      <circle cx="210" cy="118" r="18" fill="#fde68a" />
      {/* Hair */}
      <path d="M194 112 Q195 95 210 92 Q225 95 226 112" fill="#92400e" />
      <path d="M226 112 Q232 115 228 125" fill="#92400e" />
      {/* Eye */}
      <circle cx="215" cy="118" r="2" fill="#1e293b" />
      {/* Smile */}
      <path d="M210 125 Q215 130 220 125" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Body */}
      <path d="M210 136 L210 200" stroke="#7c3aed" strokeWidth="6" strokeLinecap="round" />
      {/* Arms */}
      <path d="M210 155 L195 175" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" />
      <path d="M210 155 L230 170" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" />
      {/* Legs */}
      <path d="M210 200 L198 258" stroke="#4338ca" strokeWidth="4" strokeLinecap="round" />
      <path d="M210 200 L222 258" stroke="#4338ca" strokeWidth="4" strokeLinecap="round" />
      {/* Shoes */}
      <ellipse cx="196" cy="260" rx="8" ry="4" fill="#7c3aed" />
      <ellipse cx="224" cy="260" rx="8" ry="4" fill="#7c3aed" />

      {/* Floating hearts / paw prints */}
      <g opacity="0.5">
        <path d="M60 80 Q62 72 68 78 Q74 72 76 80 Q68 90 68 90 Q68 90 60 80Z" fill="#c084fc" />
        <path d="M250 60 Q252 52 258 58 Q264 52 266 60 Q258 70 258 70 Q258 70 250 60Z" fill="#c084fc" />
      </g>

      {/* Small paw prints in the air */}
      <g fill="#ddd6fe" opacity="0.6">
        <circle cx="280" cy="100" r="4" />
        <circle cx="275" cy="93" r="2.5" />
        <circle cx="285" cy="93" r="2.5" />
        <circle cx="272" cy="98" r="2.5" />
        <circle cx="288" cy="98" r="2.5" />
      </g>
    </svg>
  );
}

/** Slide 2 — Shield with paw + checkmark (verified profiles) */
function IllustrationVerified() {
  return (
    <svg viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[280px]" aria-hidden="true">
      {/* Soft background circle */}
      <circle cx="160" cy="140" r="110" fill="#f5f3ff" />

      {/* Shield */}
      <path
        d="M160 40 L240 75 L240 155 Q240 220 160 260 Q80 220 80 155 L80 75 Z"
        fill="#ede9fe"
        stroke="#7c3aed"
        strokeWidth="3"
      />
      {/* Inner shield gradient area */}
      <path
        d="M160 60 L225 88 L225 150 Q225 205 160 240 Q95 205 95 150 L95 88 Z"
        fill="white"
      />

      {/* Paw print in shield center */}
      <g transform="translate(130, 105)">
        {/* Main pad */}
        <ellipse cx="30" cy="45" rx="18" ry="15" fill="#7c3aed" />
        {/* Toe pads */}
        <circle cx="12" cy="25" r="8" fill="#7c3aed" />
        <circle cx="30" cy="18" r="8" fill="#7c3aed" />
        <circle cx="48" cy="25" r="8" fill="#7c3aed" />
      </g>

      {/* Checkmark badge (bottom-right of shield) */}
      <circle cx="215" cy="200" r="28" fill="#10b981" />
      <circle cx="215" cy="200" r="24" fill="white" />
      <circle cx="215" cy="200" r="20" fill="#10b981" />
      <path d="M205 200 L212 208 L226 192" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Sparkle decorations */}
      <g fill="#c084fc" opacity="0.5">
        <path d="M70 60 L73 50 L76 60 L86 63 L76 66 L73 76 L70 66 L60 63Z" />
        <path d="M250 50 L252 44 L254 50 L260 52 L254 54 L252 60 L250 54 L244 52Z" />
        <path d="M95 230 L97 224 L99 230 L105 232 L99 234 L97 240 L95 234 L89 232Z" />
      </g>
    </svg>
  );
}

/** Slide 3 — Phone with booking confirmation */
function IllustrationBooking() {
  return (
    <svg viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[280px]" aria-hidden="true">
      {/* Phone frame */}
      <rect x="95" y="20" width="130" height="248" rx="20" fill="#1e1b4b" />
      <rect x="101" y="30" width="118" height="228" rx="16" fill="white" />

      {/* Status bar notch */}
      <rect x="140" y="22" width="40" height="6" rx="3" fill="#312e81" />

      {/* Screen content — mini booking UI */}
      {/* Header */}
      <rect x="111" y="46" width="98" height="8" rx="4" fill="#7c3aed" />

      {/* Dog avatar circle */}
      <circle cx="160" cy="82" r="18" fill="#fef3c7" />
      {/* Mini paw in avatar */}
      <g transform="translate(150, 74)">
        <ellipse cx="10" cy="12" rx="6" ry="5" fill="#f59e0b" />
        <circle cx="4" cy="7" r="2.5" fill="#f59e0b" />
        <circle cx="10" cy="5" r="2.5" fill="#f59e0b" />
        <circle cx="16" cy="7" r="2.5" fill="#f59e0b" />
      </g>

      {/* Sitter name placeholder */}
      <rect x="130" y="108" width="60" height="6" rx="3" fill="#cbd5e1" />

      {/* Service chips */}
      <rect x="115" y="124" width="36" height="14" rx="7" fill="#ede9fe" />
      <rect x="155" y="124" width="50" height="14" rx="7" fill="#ede9fe" />
      <rect x="121" y="127" width="24" height="8" rx="4" fill="#7c3aed" opacity="0.6" />
      <rect x="161" y="127" width="38" height="8" rx="4" fill="#7c3aed" opacity="0.6" />

      {/* Calendar mini */}
      <rect x="115" y="148" width="90" height="50" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      {/* Calendar grid dots */}
      {[0, 1, 2, 3, 4].map((col) =>
        [0, 1, 2].map((row) => (
          <circle
            key={`${col}-${row}`}
            cx={125 + col * 16}
            cy={162 + row * 12}
            r={col === 2 && row === 1 ? 5 : 3}
            fill={col === 2 && row === 1 ? "#7c3aed" : "#cbd5e1"}
          />
        )),
      )}

      {/* Confirm button */}
      <rect x="115" y="210" width="90" height="24" rx="12" fill="#7c3aed" />
      <rect x="135" y="218" width="50" height="8" rx="4" fill="white" opacity="0.9" />

      {/* Floating checkmark */}
      <circle cx="240" cy="70" r="22" fill="#10b981" />
      <path d="M230 70 L237 78 L252 62" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Confetti / celebration dots */}
      <circle cx="80" cy="60" r="5" fill="#fcd34d" opacity="0.7" />
      <circle cx="70" cy="90" r="3" fill="#c084fc" opacity="0.6" />
      <circle cx="255" cy="120" r="4" fill="#fcd34d" opacity="0.7" />
      <circle cx="265" cy="155" r="3" fill="#c084fc" opacity="0.6" />
      <circle cx="85" cy="180" r="4" fill="#7c3aed" opacity="0.3" />

      {/* Sparkle */}
      <path d="M75 140 L78 132 L81 140 L89 143 L81 146 L78 154 L75 146 L67 143Z" fill="#c084fc" opacity="0.4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Slide content
// ---------------------------------------------------------------------------

type Slide = {
  illustration: ReactNode;
  step: string;
  title: string;
  body: string;
};

const SLIDES: readonly Slide[] = [
  {
    illustration: <IllustrationWalkDog />,
    step: "01 \u00b7 LE CONCEPT",
    title: "Le dogsitting,\nr\u00e9invent\u00e9",
    body: "Trouve un dogsitter de confiance pr\u00e8s de chez toi. R\u00e9serve en quelques clics, en toute s\u00e9r\u00e9nit\u00e9.",
  },
  {
    illustration: <IllustrationVerified />,
    step: "02 \u00b7 LA CONFIANCE",
    title: "100% v\u00e9rifi\u00e9",
    body: "Chaque dogsitter passe un entretien et une v\u00e9rification d'identit\u00e9 avant d'\u00eatre publi\u00e9 sur la plateforme.",
  },
  {
    illustration: <IllustrationBooking />,
    step: "03 \u00b7 LA R\u00c9SERVATION",
    title: "R\u00e9serve en\n3 clics",
    body: "Promenade, garde \u00e0 domicile ou pension : choisis ton service, ton cr\u00e9neau, et c'est parti.",
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
            {/* Illustration area (top half) */}
            <div className="flex flex-1 items-center justify-center px-6">
              {s.illustration}
            </div>

            {/* Content card (bottom half) — white rounded top */}
            <div
              className="px-8 pb-2 pt-7"
              style={{
                background: "white",
                borderTopLeftRadius: "32px",
                borderTopRightRadius: "32px",
                boxShadow: "0 -8px 40px rgba(124, 58, 237, 0.04)",
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
          {isLast ? "Cr\u00e9er mon compte" : "Continuer"}
          <span aria-hidden="true">{"\u2192"}</span>
        </button>

        {/* Login link */}
        <p className="mt-4 text-center text-[14px] text-slate-500">
          Vous avez d\u00e9j\u00e0 un compte ?{" "}
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
