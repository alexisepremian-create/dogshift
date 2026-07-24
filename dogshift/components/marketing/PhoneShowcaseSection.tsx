"use client";

/**
 * Homepage "phone showcase" section (marketing).
 *
 * Left: a CSS iPhone mock cycling through 3 screens (users' favourite
 * features). Right: a violet card whose copy is synced to the active screen.
 *
 * Scroll behaviour (desktop ≥ lg): the section is tall (`lg:h-[340vh]`) with an
 * inner `sticky top-0 h-screen` container. As the user scrolls, the sticky
 * container stays pinned (the page appears frozen) while a passive + rAF scroll
 * listener maps scroll progress to the active screen (0→1→2). Once the 3 screens
 * are consumed the sticky releases and the page continues scrolling to the
 * "Rencontre" teaser below. No scroll hijacking (`preventDefault`) — that breaks
 * iOS/touch and a11y — we only read native scroll.
 *
 * Mobile (< lg): no pin. The screens auto-advance on a timer and can be tapped
 * via the dots; layout stacks. Animations are transform/opacity only, per
 * docs/PERFORMANCE.md (no backdrop-blur, no transition-all, no layout anims).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarCheck,
  Heart,
  Lock,
  MapPin,
  MessagesSquare,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// ── Phone screens ─────────────────────────────────────────────────────────────

function ScreenBooking() {
  return (
    <div className="flex h-full w-full flex-col gap-3 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
          Réservation
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <ShieldCheck className="h-3 w-3" aria-hidden /> Confirmée
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--dogshift-blue)]/10 text-[var(--dogshift-blue)]">
            <CalendarCheck className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-slate-900">Balade avec Léa</p>
            <p className="text-[11px] text-slate-500">Sam. 26 juil. · 14 h 00</p>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2.5 text-white">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/90">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Paiement sécurisé
        </span>
        <span className="text-[13px] font-semibold">25 CHF</span>
      </div>
    </div>
  );
}

function ScreenTrust() {
  return (
    <div className="flex h-full w-full flex-col gap-3 bg-white p-4">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
        Dogsitter vérifié
      </span>

      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--dogshift-blue)] to-fuchsia-400 text-white">
          <PawPrint className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="flex items-center gap-1 text-[13px] font-semibold text-slate-900">
            Léa · Vevey
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
          </p>
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden /> 4.9 · 12 avis
          </p>
        </div>
      </div>

      <div className="relative mt-1 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_30%_30%,#ede9fe,transparent_60%),radial-gradient(circle_at_75%_70%,#fae8ff,transparent_55%)]">
        <span className="absolute left-1/2 top-1/2 inline-flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--dogshift-blue)] text-white shadow-lg">
          <MapPin className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <p className="text-[11px] text-slate-500">À 1.2 km de toi · dispo cette semaine</p>
    </div>
  );
}

function ScreenNews() {
  const tiles = [
    "from-violet-200 to-violet-100",
    "from-amber-200 to-amber-100",
    "from-emerald-200 to-emerald-100",
  ];
  return (
    <div className="flex h-full w-full flex-col gap-3 bg-white p-4">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
        Nouvelles · Aujourd’hui
      </span>
      <p className="text-[13px] font-semibold leading-snug text-slate-900">
        Milo a passé une super journée 🐾
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        {tiles.map((t, i) => (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br ${t}`}
          >
            <PawPrint className="h-4 w-4 text-white/80" aria-hidden />
          </div>
        ))}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] text-slate-500">Durée</p>
          <p className="text-[12px] font-semibold text-slate-900">58 min</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] text-slate-500">Humeur</p>
          <p className="text-[12px] font-semibold text-slate-900">Détendu</p>
        </div>
      </div>
    </div>
  );
}

type Feature = {
  key: string;
  label: string;
  title: string;
  text: string;
  screen: ReactNode;
};

const FEATURES: Feature[] = [
  {
    key: "booking",
    label: "Réservation",
    title: "Réserve en quelques clics.",
    text: "Choisis ton dogsitter, ta date, et paie en toute sécurité. Le créneau est garanti dès la confirmation.",
    screen: <ScreenBooking />,
  },
  {
    key: "trust",
    label: "Confiance",
    title: "Des dogsitters vérifiés près de toi.",
    text: "Profils vérifiés, avis réels et localisation sur la carte — de Lausanne à la Riviera vaudoise.",
    screen: <ScreenTrust />,
  },
  {
    key: "news",
    label: "Sérénité",
    title: "Reste connecté pendant la garde.",
    text: "Photos, messages et nouvelles de ton chien en direct. Tu sais qu’il est entre de bonnes mains.",
    screen: <ScreenNews />,
  },
];

// ── Phone frame ───────────────────────────────────────────────────────────────

function PhoneFrame({ active }: { active: number }) {
  return (
    <div className="relative mx-auto aspect-[9/19] w-[248px] rounded-[2.6rem] border-[11px] border-slate-900 bg-slate-900 shadow-[0_40px_90px_-45px_rgba(2,6,23,0.55)] sm:w-[272px]">
      {/* notch */}
      <div className="absolute left-1/2 top-0 z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-slate-900" />
      <div className="relative h-full w-full overflow-hidden rounded-[1.9rem] bg-white">
        {FEATURES.map((f, i) => (
          <div
            key={f.key}
            aria-hidden={i !== active}
            className="absolute inset-0 transition-[opacity,transform] duration-500 ease-out"
            style={{
              opacity: i === active ? 1 : 0,
              transform: i === active ? "translateY(0)" : "translateY(10px)",
              pointerEvents: i === active ? "auto" : "none",
            }}
          >
            {f.screen}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Rencontre teaser ──────────────────────────────────────────────────────────

function RencontreTeaser() {
  return (
    <section className="bg-white pb-16 sm:pb-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="grid gap-8 overflow-hidden rounded-3xl bg-[var(--dogshift-blue)] p-8 text-white shadow-[0_30px_80px_-50px_rgba(124,58,237,0.7)] sm:p-12 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              <Heart className="h-3.5 w-3.5" aria-hidden /> Bientôt · Rencontre
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Rencontre arrive.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
              Mets ton chien en relation avec des compagnons compatibles, de la Riviera vaudoise à
              tout le canton, pour donner vie à une portée. On t’accompagne dans le respect des
              règles suisses : le bien-être animal d’abord, et chaque portée annoncée au vétérinaire
              cantonal.
            </p>
            <p className="mt-4 max-w-xl text-xs leading-relaxed text-white/60">
              En Suisse, toute reproduction relève de l’élevage au sens de la loi. Dans le canton de
              Vaud, les portées s’annoncent au Service vétérinaire (DGAV).
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[var(--dogshift-blue)] shadow-sm">
              <Sparkles className="h-4 w-4" aria-hidden /> Bientôt disponible
            </span>
            <p className="text-xs text-white/70 lg:text-right">On te préviendra au lancement.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function PhoneShowcaseSection() {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);

  // Desktop (≥ lg): scroll progress drives the active screen while the inner
  // container is pinned. Mobile: auto-advance on a timer. Re-wired on breakpoint
  // change so resizing between desktop/mobile keeps the right driver.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    let cleanup = () => {};

    const setup = () => {
      cleanup();
      if (mq.matches) {
        let ticking = false;
        const onScroll = () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            const el = sectionRef.current;
            if (el) {
              const total = el.offsetHeight - window.innerHeight;
              const p = total > 0 ? clamp(-el.getBoundingClientRect().top / total, 0, 1) : 0;
              const idx = Math.min(FEATURES.length - 1, Math.floor(p * FEATURES.length));
              setActive((prev) => (prev === idx ? prev : idx));
            }
            ticking = false;
          });
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        cleanup = () => window.removeEventListener("scroll", onScroll);
      } else {
        const id = setInterval(() => setActive((p) => (p + 1) % FEATURES.length), 3500);
        cleanup = () => clearInterval(id);
      }
    };

    setup();
    mq.addEventListener("change", setup);
    return () => {
      cleanup();
      mq.removeEventListener("change", setup);
    };
  }, []);

  const current = FEATURES[active];

  return (
    <>
      <section ref={sectionRef} className="relative bg-white lg:h-[340vh]">
        <div className="flex items-center py-16 sm:py-20 lg:sticky lg:top-0 lg:h-screen lg:py-0">
          <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
                Fonctionnalités
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Ce que nos utilisateurs préfèrent.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Trois raisons de garder DogShift à portée de main.
              </p>
            </div>

            <div className="mt-10 grid items-center gap-10 lg:mt-14 lg:grid-cols-2 lg:gap-16">
              <PhoneFrame active={active} />

              <div className="rounded-3xl bg-[var(--dogshift-blue)] p-8 text-white shadow-[0_30px_80px_-50px_rgba(124,58,237,0.7)] sm:p-10">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  {current.label}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {current.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
                  {current.text}
                </p>

                <div className="mt-7 flex items-center gap-2">
                  {FEATURES.map((f, i) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={`Voir : ${f.title}`}
                      style={{ touchAction: "manipulation" }}
                      className={`h-2 rounded-full transition-[width,background-color] duration-300 ${
                        i === active ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
                      }`}
                    />
                  ))}
                </div>

                <p className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-white/70">
                  <MessagesSquare className="h-4 w-4" aria-hidden />
                  Pensé pour te simplifier la vie.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <RencontreTeaser />
    </>
  );
}
