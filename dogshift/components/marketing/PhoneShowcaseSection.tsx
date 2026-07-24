"use client";

/**
 * Homepage "phone showcase" section (marketing).
 *
 * Left: a CSS iPhone mock cycling through 3 screens (users' favourite
 * features). Right: the section title + a violet card whose copy is synced to
 * the active screen, ending with a "Réserve maintenant" CTA on the last screen.
 *
 * Scroll behaviour (desktop ≥ lg): the section is tall (`lg:h-[360vh]`) with an
 * inner `sticky top-0 h-screen` container. As the user scrolls, the sticky
 * container stays pinned (the page appears frozen) while a passive + rAF scroll
 * listener maps scroll progress to the active screen (0→1→2). Once the 3 screens
 * are consumed the sticky releases and the page continues to the "Rencontre"
 * teaser below. No scroll hijacking (`preventDefault`) — that breaks iOS/touch
 * and a11y — we only read native scroll.
 *
 * Mobile (< lg): no pin. Screens auto-advance on a timer and can be tapped via
 * the dots; layout stacks. Animations are transform/opacity only, per
 * docs/PERFORMANCE.md (no backdrop-blur, no transition-all, no layout anims).
 *
 * Screen 3 photos: `public/iphone_1.jpg`, `iphone_2.jpg`, `iphone_3.jpg`.
 * They're layered over a gradient, so if a file is missing the tile still looks
 * good (gradient fallback).
 */

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Clock,
  Heart,
  Lock,
  MapPin,
  MessagesSquare,
  PawPrint,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Screen shell — consistent padding that clears the notch at the top.
function Screen({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full flex-col gap-3 bg-white px-4 pb-4 pt-9">{children}</div>;
}

function ScreenLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
      {children}
    </span>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--dogshift-blue)]/10 text-[var(--dogshift-blue)]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="ml-auto text-[12px] font-semibold text-slate-900">{value}</span>
    </div>
  );
}

// ── Screen 1 — Réservation ────────────────────────────────────────────────────

function ScreenBooking() {
  return (
    <Screen>
      <div className="flex items-center justify-between">
        <ScreenLabel>Réservation</ScreenLabel>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <ShieldCheck className="h-3 w-3" aria-hidden /> Confirmée
        </span>
      </div>

      <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--dogshift-blue)] to-fuchsia-400 text-white">
          <PawPrint className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-slate-900">Balade avec Léa</p>
          <p className="text-[11px] text-slate-500">Sam. 26 juil. · 14 h 00</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 p-3">
        <DetailRow icon={MapPin} label="Lieu" value="Vevey centre" />
        <DetailRow icon={Clock} label="Durée" value="1 h de balade" />
        <DetailRow icon={PawPrint} label="Chien" value="Milo · moyen" />
      </div>

      <div className="mt-auto flex items-center justify-between rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2.5 text-white">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/90">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Paiement sécurisé
        </span>
        <span className="text-[13px] font-semibold">25 CHF</span>
      </div>
    </Screen>
  );
}

// ── Screen 2 — Confiance ──────────────────────────────────────────────────────

function ScreenTrust() {
  return (
    <Screen>
      <ScreenLabel>Dogsitter vérifié</ScreenLabel>

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

      <div className="flex flex-wrap gap-1.5">
        {["Vérifiée", "Assurée", "Répond en ~1 h"].map((b) => (
          <span
            key={b}
            className="rounded-full bg-[var(--dogshift-blue)]/10 px-2.5 py-1 text-[10px] font-semibold text-[var(--dogshift-blue)]"
          >
            {b}
          </span>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
        <Quote className="h-4 w-4 text-[var(--dogshift-blue)]/40" aria-hidden />
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          Léa est adorable, Milo l’attend déjà à la porte à chaque fois !
        </p>
        <p className="mt-1.5 text-[10px] font-semibold text-slate-400">— Sophie, propriétaire de Milo</p>
      </div>

      <div className="relative mt-auto h-24 overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_30%_30%,#ede9fe,transparent_60%),radial-gradient(circle_at_75%_70%,#fae8ff,transparent_55%)]">
        <span className="absolute left-1/2 top-1/2 inline-flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--dogshift-blue)] text-white shadow-lg">
          <MapPin className="h-4 w-4" aria-hidden />
        </span>
        <span className="absolute bottom-2 left-3 text-[10px] font-medium text-slate-500">
          À 1.2 km de toi · dispo cette semaine
        </span>
      </div>
    </Screen>
  );
}

// ── Screen 3 — Nouvelles ──────────────────────────────────────────────────────

const NEWS_TILES = [
  { src: "/iphone_1.jpg", tone: "linear-gradient(135deg,#ddd6fe,#ede9fe)" },
  { src: "/iphone_2.jpg", tone: "linear-gradient(135deg,#fde68a,#fef3c7)" },
  { src: "/iphone_3.jpg", tone: "linear-gradient(135deg,#a7f3d0,#d1fae5)" },
];

function ScreenNews() {
  return (
    <Screen>
      <ScreenLabel>Nouvelles · Aujourd’hui</ScreenLabel>
      <p className="text-[13px] font-semibold leading-snug text-slate-900">
        Milo a passé une super journée 🐾
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        {NEWS_TILES.map((t, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl bg-cover bg-center"
            style={{ backgroundImage: `url('${t.src}'), ${t.tone}` }}
          />
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50/70 p-3">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--dogshift-blue)] to-fuchsia-400 text-white">
          <PawPrint className="h-3 w-3" aria-hidden />
        </span>
        <p className="text-[11px] leading-relaxed text-slate-600">
          Il a adoré courir au parc, gros dodo maintenant 🥰
        </p>
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
    </Screen>
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
  const isLast = active === FEATURES.length - 1;

  return (
    <>
      <section ref={sectionRef} className="relative bg-white lg:h-[360vh]">
        <div className="flex flex-col justify-center px-6 py-16 sm:px-8 sm:py-20 lg:sticky lg:top-0 lg:h-screen lg:px-10 lg:py-0 lg:pt-24">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <PhoneFrame active={active} />

            <div>
              {/* Section title — above the violet card so it stays visible while pinned */}
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
                Fonctionnalités
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Ce que nos utilisateurs préfèrent.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Trois raisons de garder DogShift à portée de main.
              </p>

              <div className="mt-6 rounded-3xl bg-[var(--dogshift-blue)] p-7 text-white shadow-[0_30px_80px_-50px_rgba(124,58,237,0.7)] sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  {current.label}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                  {current.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/85">{current.text}</p>

                <div className="mt-6 flex items-center gap-2">
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

                {isLast ? (
                  <Link
                    href="/search"
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--dogshift-blue)] shadow-sm transition hover:bg-white/90"
                  >
                    Réserve maintenant
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : (
                  <p className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-white/70">
                    <MessagesSquare className="h-4 w-4" aria-hidden />
                    Continue de défiler pour tout voir.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <RencontreTeaser />
    </>
  );
}
