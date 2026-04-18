"use client";

import { useState, useEffect, useRef } from "react";

/* ── Config ────────────────────────────────────────────────────── */

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const DEFAULT_MIN = 2400;
const FADE_MS = 450;

export const PAGE_LOADER_MIN_DURATION_MS = DEFAULT_MIN;

/* ── Helpers ───────────────────────────────────────────────────── */

function reveal(delay: number, dur = 0.5): React.CSSProperties {
  return {
    opacity: 0,
    animation: `brandReveal ${dur}s ${EASE} ${delay}s forwards`,
  };
}

/* ── SVG path data ─────────────────────────────────────────────── */

const DOG_BODY =
  "M3315 7896 c-245 -40 -412 -106 -576 -227 -85 -62 -300 -284 -412 -424 -115 -144 -253 -349 -278 -414 -26 -69 -25 -165 2 -228 14 -32 47 -74 104 -129 l83 -80 -28 -110 c-99 -383 -251 -652 -561 -993 -277 -306 -383 -444 -496 -651 -272 -496 -355 -1139 -200 -1545 133 -348 424 -570 860 -654 161 -31 395 -43 787 -39 l356 3 49 26 c30 15 62 42 80 68 26 37 30 53 33 119 4 93 -16 157 -72 235 -73 101 -168 147 -302 147 -46 0 -84 3 -84 6 0 3 11 20 25 38 41 54 112 216 136 311 26 104 30 278 10 385 -33 169 -127 337 -270 481 -76 77 -104 98 -133 103 -91 16 -167 -71 -127 -146 6 -11 48 -57 94 -102 92 -91 149 -181 192 -302 25 -71 28 -92 28 -214 0 -126 -2 -141 -32 -223 -42 -120 -112 -231 -210 -338 -94 -101 -101 -126 -57 -178 l26 -31 196 0 c212 -1 274 -9 310 -43 30 -27 52 -69 52 -97 l0 -21 -462 3 c-508 5 -563 10 -743 69 -155 52 -259 113 -355 209 -167 167 -226 323 -236 625 -12 320 53 609 205 920 103 209 202 347 454 627 81 90 179 204 218 253 198 249 344 529 430 822 l21 73 66 -60 c96 -85 216 -174 281 -207 49 -24 67 -28 146 -28 78 0 97 4 141 27 97 51 160 147 190 290 21 96 13 362 -15 548 -46 303 -48 508 -5 733 21 112 27 123 66 131 89 16 287 24 405 15 238 -17 371 -65 478 -172 54 -55 75 -86 135 -208 135 -277 236 -368 490 -444 l105 -31 5 -60 c7 -83 36 -125 111 -163 33 -16 80 -33 105 -37 l46 -7 -7 -36 c-29 -155 -160 -327 -297 -391 -104 -48 -170 -62 -340 -67 -173 -6 -332 7 -473 38 -107 24 -145 19 -179 -22 -44 -52 -33 -123 25 -158 l30 -18 -24 -16 c-35 -23 -114 -131 -154 -211 -87 -173 -112 -419 -77 -747 25 -231 25 -469 0 -563 -42 -157 -100 -263 -240 -436 -113 -140 -119 -160 -124 -418 -7 -410 40 -671 167 -918 46 -90 62 -111 111 -145 34 -23 43 -24 225 -27 l190 -3 55 28 c33 17 68 45 87 70 57 76 67 202 23 300 -40 90 -146 174 -238 189 -35 5 -41 10 -50 43 -19 64 -31 161 -42 346 -17 268 -2 500 52 840 40 247 42 409 10 687 -12 103 -22 229 -22 282 0 304 97 510 279 594 54 25 65 27 306 33 225 7 259 10 343 33 161 45 258 102 362 213 147 156 240 411 240 653 0 100 -15 147 -59 191 -43 43 -85 57 -298 100 -349 69 -421 119 -531 367 -121 272 -314 432 -602 497 -100 23 -498 30 -615 11z m-309 -341 c-36 -95 -32 -504 8 -810 44 -335 34 -501 -35 -559 -55 -47 -115 -30 -231 66 -131 109 -447 388 -473 419 -33 40 -30 65 21 146 166 260 448 579 619 697 84 58 101 66 91 41z m620 -4053 c1 -274 16 -400 64 -555 34 -110 100 -167 193 -167 71 0 124 -68 92 -117 -15 -22 -21 -23 -139 -23 l-123 0 -32 60 c-88 164 -130 369 -138 666 -6 226 1 276 49 349 16 25 31 45 31 45 1 0 3 -116 3 -258z";

const DOG_EYE =
  "M3891 7223 c-67 -33 -106 -132 -82 -206 24 -73 95 -127 166 -127 46 0 109 34 141 76 25 33 29 46 29 105 0 75 -16 106 -75 147 -41 27 -128 30 -179 5z";

const LETTERS: { d: string; delay: number }[] = [
  { delay: 0.6, d: "M4500 4900 l0 -640 248 0 c137 0 275 5 308 11 162 30 291 148 338 309 45 152 41 510 -7 643 -49 134 -113 207 -231 263 -101 48 -149 54 -417 54 l-239 0 0 -640z m527 367 c102 -52 131 -122 140 -332 14 -345 -52 -442 -308 -451 l-109 -3 0 411 0 411 113 -5 c95 -4 120 -9 164 -31z" },
  { delay: 0.7, d: "M5950 5546 c-111 -25 -218 -99 -279 -194 -16 -26 -40 -81 -53 -122 -22 -71 -23 -90 -23 -335 1 -222 3 -269 19 -319 61 -201 193 -316 385 -334 285 -28 480 97 542 348 22 86 19 535 -3 617 -49 179 -166 299 -329 338 -76 17 -182 18 -259 1z m218 -245 c110 -57 136 -148 130 -453 -5 -211 -15 -257 -66 -312 -80 -85 -234 -89 -313 -6 -58 61 -69 119 -69 367 0 228 7 272 55 345 16 24 43 47 68 59 56 25 146 25 195 0z" },
  { delay: 0.8, d: "M7073 5545 c-165 -36 -279 -151 -329 -332 -21 -77 -30 -403 -15 -540 23 -211 109 -340 270 -404 68 -27 256 -38 341 -20 116 24 213 89 264 176 46 77 56 142 56 352 l0 193 -230 0 -230 0 0 -110 0 -110 105 0 105 0 0 -59 c0 -71 -14 -117 -49 -155 -78 -86 -222 -88 -308 -4 -59 57 -68 104 -68 363 0 243 6 283 48 346 48 71 164 101 250 65 44 -18 85 -69 99 -122 l12 -44 124 0 125 0 -6 66 c-19 245 -279 401 -564 339z" },
  { delay: 0.95, d: "M4788 3990 c-112 -20 -228 -101 -273 -190 -33 -65 -47 -152 -35 -228 23 -163 114 -245 377 -336 176 -61 220 -93 230 -166 13 -92 -61 -154 -182 -154 -122 -1 -203 57 -219 153 l-6 41 -122 0 -121 0 6 -59 c19 -176 140 -312 312 -349 241 -53 464 25 553 193 25 46 27 59 27 170 0 111 -2 124 -27 171 -49 94 -121 141 -324 215 -213 77 -255 108 -258 188 -1 67 56 126 134 137 102 14 198 -46 220 -136 l12 -50 119 0 119 0 0 48 c-1 156 -97 285 -248 332 -75 24 -220 34 -294 20z" },
  { delay: 1.05, d: "M5520 3345 l0 -636 123 3 122 3 3 258 2 257 215 0 215 0 0 -260 0 -260 125 0 125 0 0 635 0 635 -125 0 -125 0 0 -258 c0 -142 -2 -261 -4 -263 -2 -2 -100 -3 -218 -1 l-213 3 3 259 3 260 -126 0 -125 0 0 -635z" },
  { delay: 1.15, d: "M6690 3345 l0 -635 125 0 125 0 0 635 0 635 -125 0 -125 0 0 -635z" },
  { delay: 1.25, d: "M7180 3345 l0 -635 125 0 125 0 0 250 0 250 225 0 225 0 0 115 0 115 -225 0 -225 0 0 150 0 150 265 0 265 0 0 120 0 120 -390 0 -390 0 0 -635z" },
  { delay: 1.35, d: "M8090 3860 l0 -120 150 0 150 0 0 -515 0 -515 125 0 125 0 0 515 0 515 155 0 155 0 0 120 0 120 -430 0 -430 0 0 -120z" },
];

/* ── All SVG paths (static version, no stagger animation) ──────── */

const ALL_PATHS = [DOG_BODY, DOG_EYE, ...LETTERS.map((l) => l.d)];

/* ── Component ─────────────────────────────────────────────────── */

type Props = {
  label?: string;
  /** Signal that content/data behind the loader is ready */
  ready?: boolean;
  /** Called when the overlay is fully dismissed (after fade-out) */
  onDone?: () => void;
  /** Minimum ms before the loader can start dismissing (default 1800) */
  minDuration?: number;
  /** If true, skip fade-out — overlay stays visible (for page navigations) */
  persist?: boolean;
  /** If true, skip stagger and show the logo immediately pulsing */
  static?: boolean;
};

export default function PageLoader({
  label = "Chargement…",
  ready,
  onDone,
  minDuration = DEFAULT_MIN,
  persist = false,
  static: isStatic = false,
}: Props) {
  const mountRef = useRef(Date.now());
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const [phase, setPhase] = useState<"animate" | "fadeOut" | "done">("animate");

  const [displayLabel] = useState(label);

  useEffect(() => {
    if (ready !== true) return;

    const elapsed = Date.now() - mountRef.current;
    const wait = Math.max(0, minDuration - elapsed);

    if (persist) {
      const t = setTimeout(() => {
        onDoneRef.current?.();
      }, wait);
      return () => clearTimeout(t);
    }

    const t1 = setTimeout(() => setPhase("fadeOut"), wait);
    const t2 = setTimeout(() => {
      setPhase("done");
      onDoneRef.current?.();
    }, wait + FADE_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready, minDuration, persist]);

  if (phase === "done") return null;

  return (
    <div
      className="ds-viewport fixed inset-0 z-50 flex w-full items-center justify-center bg-white font-sans"
      style={{
        transition: phase === "fadeOut" ? `opacity ${FADE_MS}ms ease` : undefined,
        opacity: phase === "fadeOut" ? 0 : 1,
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="flex flex-col items-center"
        style={{
          animation: isStatic
            ? "brandPulse 2.8s ease-in-out infinite"
            : "brandPulse 2.8s ease-in-out 2.2s infinite",
          willChange: "opacity",
        }}
      >
        <svg
          viewBox="70 190 870 610"
          className="w-52 text-slate-800"
          aria-hidden="true"
        >
          <g
            transform="translate(0,1024) scale(0.1,-0.1)"
            fill="currentColor"
            stroke="none"
          >
            {isStatic ? (
              ALL_PATHS.map((d, i) => <path key={i} d={d} />)
            ) : (
              <>
                <path d={DOG_BODY} style={reveal(0, 0.8)} />
                <path d={DOG_EYE} style={reveal(0.4, 0.3)} />
                {LETTERS.map((l, i) => (
                  <path key={i} d={l.d} style={reveal(l.delay, 0.35)} />
                ))}
              </>
            )}
          </g>
        </svg>

        <p
          className="mt-5 text-[13px] font-medium tracking-[0.18em] text-slate-400"
          style={isStatic ? undefined : reveal(1.6, 0.6)}
        >
          {displayLabel}
        </p>
      </div>
    </div>
  );
}
