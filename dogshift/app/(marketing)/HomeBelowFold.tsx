"use client";
/* eslint-disable react-hooks/refs, @next/next/no-img-element */

/**
 * Below-the-fold homepage sections.
 *
 * Why a separate file:
 * The homepage's main client component (`HomePageClient.tsx`) was a single
 * ~3000-line client island. Every nested section (FeaturedSitters,
 * Reassurance, Services, HowItWorks, Security, Map, BecomeSitter,
 * WhyDogShift, FAQ, Cities) hydrated synchronously on first paint, blocking
 * the main thread for 1–3 seconds on mobile. Users reported that the
 * hamburger and hero search bar felt sluggish until they scrolled —
 * because by the time they scrolled, hydration had finished.
 *
 * By extracting everything from `FeaturedSittersSection` onward into this
 * file and loading it via `next/dynamic` from `HomePageClient.tsx`, the
 * client bundle is code-split: the hero ships in the main chunk (small,
 * parses fast), and this larger chunk streams in afterwards. React 19
 * uses selective hydration so the hero becomes interactive while this
 * tree is still being parsed/hydrated.
 *
 * SEO is preserved because `ssr: true` keeps server rendering — search
 * engines see the full HTML.
 */

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileText,
  Handshake,
  Lock,
  MapPin,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Umbrella,
  UserCheck,
  Wallet,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import MapPreview from "@/components/MapPreview";
import SitterCard, { type SitterPreview } from "@/components/ui/SitterCard";

// ── HOOKS ─────────────────────────────────────────────────────────────────────

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(Boolean(mql.matches));
    onChange();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return reduced;
}

function useRevealOnce({ repeat = false } = {}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setRevealed(true);
          if (!repeat) obs.disconnect();
        } else if (repeat) {
          setRevealed(false);
        }
      },
      { threshold: 0.14 },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  const style = prefersReducedMotion
    ? undefined
    : {
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(8px)",
        transition:
          "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)",
      };

  return { ref, style };
}

function useStaggerReveal(count: number, { baseDelay = 0, step = 80, repeat = false } = {}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setRevealed(true);
          if (!repeat) obs.disconnect();
        } else if (repeat) {
          setRevealed(false);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  function itemStyle(index: number): React.CSSProperties {
    if (prefersReducedMotion) return {};
    const delay = baseDelay + index * step;
    return {
      opacity: revealed ? 1 : 0,
      transform: revealed ? "translateY(0)" : "translateY(8px)",
      transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    };
  }

  void count;
  return { ref, itemStyle };
}

// ── FEATURED SITTERS ──────────────────────────────────────────────────────────

const CARD_W = 240;
const CARD_GAP = 14;

function SitterCarousel({
  sitters,
  city,
  label: labelOverride,
  isFirst = false,
}: {
  sitters: SitterPreview[];
  city: string;
  label?: string;
  isFirst?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  function slide(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -(CARD_W + CARD_GAP) * 2 : (CARD_W + CARD_GAP) * 2, behavior: "smooth" });
  }

  const label = labelOverride ?? (city ? `Dogsitters à ${city}` : "Profils disponibles");
  const searchHref = city ? `/search?location=${encodeURIComponent(city)}` : "/search";

  return (
    <div className={isFirst ? "relative" : "relative mt-6"}>
      <div className="mb-3 flex items-center justify-between gap-4 px-6 sm:px-8 lg:px-10">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 sm:text-base">
          {!labelOverride && <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--dogshift-blue)]" aria-hidden="true" />}
          {label}
        </h3>
        <div className="flex items-center gap-2.5">
          <Link
            href={searchHref}
            className="hidden text-xs font-semibold text-[var(--dogshift-blue)] transition-colors hover:text-[var(--dogshift-blue-hover)] sm:inline"
          >
            Tout voir
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => slide("left")}
              disabled={!canLeft}
              aria-label="Précédent"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => slide("right")}
              disabled={!canRight}
              aria-label="Suivant"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth px-6 pb-4 scroll-pl-6 sm:gap-5 sm:px-8 sm:scroll-pl-8 lg:px-10 lg:scroll-pl-10 [-webkit-overflow-scrolling:touch] [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sitters.map((sitter, index) => (
          <div
            key={sitter.sitterId}
            className="w-[155px] shrink-0 [scroll-snap-align:start] sm:w-[210px]"
          >
            <SitterCard sitter={sitter} priority={index < 4} />
          </div>
        ))}

        <div className="flex shrink-0 items-center [scroll-snap-align:start]">
          <Link
            href={searchHref}
            className="group flex flex-col items-center gap-2 px-2"
            aria-label={city ? `Voir tous les dogsitters à ${city}` : "Voir tous les profils"}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-200 group-hover:border-[var(--dogshift-blue)]/50 group-hover:bg-slate-50 group-hover:text-[var(--dogshift-blue)] group-hover:shadow-md">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-medium text-slate-500 transition-colors group-hover:text-[var(--dogshift-blue)]">
              Voir tout
            </span>
          </Link>
        </div>

        <div className="w-1 shrink-0 sm:w-2" aria-hidden="true" />
      </div>
    </div>
  );
}

function FeaturedSittersSection({ sitters }: { sitters: SitterPreview[] }) {
  const reveal = useRevealOnce({ repeat: true });
  const recentSitters = sitters.slice(0, 8);

  if (sitters.length === 0) return null;

  return (
    <section className="bg-slate-50 py-5 sm:py-7">
      <div className="mx-auto max-w-7xl">
        <div ref={reveal.ref} style={reveal.style} className="mb-4 px-6 sm:px-8 lg:px-10">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            Dogsitters disponibles
          </h2>
        </div>

        {recentSitters.length > 0 && (
          <SitterCarousel
            sitters={recentSitters}
            city=""
            label="Récemment ajoutés"
            isFirst
          />
        )}

        <div className="mt-6 px-6 sm:px-8 lg:px-10">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
          >
            Voir tous les profils
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── REASSURANCE ───────────────────────────────────────────────────────────────

const REASSURANCE_ITEMS = [
  { icon: BadgeCheck, title: "Profils vérifiés", desc: "Sélectionnés manuellement avec vérification du casier judiciaire et entretien préalable.", iconClass: "text-[var(--dogshift-blue)]", iconBg: "bg-[var(--dogshift-blue)]/10 ring-[var(--dogshift-blue)]/20" },
  { icon: FileCheck, title: "Réservation simple", desc: "Trouvez, comparez et réservez en quelques clics — sans friction et sans paperasse.", iconClass: "text-[var(--dogshift-blue)]", iconBg: "bg-[var(--dogshift-blue)]/10 ring-[var(--dogshift-blue)]/20" },
  { icon: Lock, title: "Paiement sécurisé", desc: "Paiement en ligne sécurisé via Stripe. Votre argent est protégé jusqu'à la fin de la prestation.", iconClass: "text-[var(--dogshift-blue)]", iconBg: "bg-[var(--dogshift-blue)]/10 ring-[var(--dogshift-blue)]/20" },
  { icon: ShieldCheck, title: "Support humain", desc: "Une équipe à votre écoute pour vous accompagner à chaque étape de la garde.", iconClass: "text-[var(--dogshift-blue)]", iconBg: "bg-[var(--dogshift-blue)]/10 ring-[var(--dogshift-blue)]/20" },
] as const;

function ReassuranceSection() {
  const stagger = useStaggerReveal(4, { step: 80, repeat: true });

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Pourquoi nous faire confiance
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Une plateforme construite avec exigence
          </h2>
          <div ref={stagger.ref as React.RefObject<HTMLDivElement>} className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REASSURANCE_ITEMS.map(({ icon: Icon, title, desc, iconClass, iconBg }, i) => (
              <div key={title} style={stagger.itemStyle(i)} className="group rounded-3xl border border-slate-200 bg-white p-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300/80 hover:bg-slate-50/50 hover:shadow-[0_8px_30px_rgba(2,6,23,0.06)]">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${iconBg}`}>
                  <Icon className={`h-5 w-5 ${iconClass}`} aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SERVICES ──────────────────────────────────────────────────────────────────

const SERVICES_DETAIL = [
  { icon: MapPin, label: "Promenade", desc: "Sorties individuelles adaptées au rythme et à la personnalité de votre chien, assurées par un dogsitter sélectionné.", benefit: "Idéal pour les journées chargées", detail: "30 min à 2 heures", href: "/search?service=Promenade", iconClass: "text-sky-600", iconBg: "bg-sky-50 ring-sky-200/80" },
  { icon: Shield, label: "Dogsitting", desc: "Garde à domicile chez le dogsitter, dans un environnement familier et rassurant pour votre chien.", benefit: "Une journée complète en toute sécurité", detail: "De quelques heures à la journée", href: "/search?service=Garde", iconClass: "text-violet-600", iconBg: "bg-violet-50 ring-violet-200/80" },
  { icon: Umbrella, label: "Pension", desc: "Hébergement complet chez le dogsitter pour vos voyages ou absences prolongées. Votre chien vit comme à la maison.", benefit: "Des vacances sereines pour vous deux", detail: "Nuit ou semaine", href: "/search?service=Pension", iconClass: "text-amber-600", iconBg: "bg-amber-50 ring-amber-200/80" },
] as const;

function ServicesSection() {
  const reveal = useRevealOnce({ repeat: true });
  const stagger = useStaggerReveal(3, { step: 120, repeat: true });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div ref={reveal.ref} style={reveal.style} className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Nos services
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Un service adapté à chaque besoin
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Que vous ayez besoin d&apos;une sortie ponctuelle ou d&apos;un hébergement complet, DogShift
            propose le service qui correspond à votre situation.
          </p>
        </div>

        <div ref={stagger.ref as React.RefObject<HTMLDivElement>} className="mt-8 grid gap-5 sm:grid-cols-3 lg:gap-6">
          {SERVICES_DETAIL.map(({ icon: Icon, label, desc, benefit, detail, href, iconClass, iconBg }, i) => (
            <div key={label} style={stagger.itemStyle(i)} className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.14)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-42px_rgba(2,6,23,0.21)]">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${iconBg}`}>
                <Icon className={`h-6 w-6 ${iconClass}`} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{label}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{desc}</p>
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium text-slate-500">{detail}</p>
                <p className="text-xs font-semibold text-emerald-700">{benefit}</p>
              </div>
              <Link href={href} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--dogshift-blue)] transition-colors duration-200 hover:text-[var(--dogshift-blue-hover)]">
                Trouver un dogsitter
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── HOW IT WORKS ──────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { step: 1, icon: Search, title: "Cherchez", desc: "Indiquez votre ville, sélectionnez votre service et choisissez vos dates pour voir les profils disponibles." },
  { step: 2, icon: BadgeCheck, title: "Choisissez", desc: "Consultez les profils vérifiés, lisez les avis et échangez directement avec le dogsitter." },
  { step: 3, icon: Wallet, title: "Réservez", desc: "Confirmez votre demande et réglez en ligne en toute sécurité via notre système de paiement intégré." },
  { step: 4, icon: Handshake, title: "Confiez sereinement", desc: "Votre chien est entre de bonnes mains. Suivez la prestation et laissez un avis après la garde." },
] as const;

function HowItWorksSection() {
  const headerReveal = useRevealOnce({ repeat: true });
  const stepsReveal = useStaggerReveal(4, { step: 130, repeat: true });

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div ref={headerReveal.ref} style={headerReveal.style} className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
              Comment ça marche
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Simple, sécurisé, serein
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              De la recherche à la garde, tout se passe sur DogShift — en quelques clics.
            </p>
          </div>

          <div className="relative mt-12">
            <svg
              className="pointer-events-none absolute left-1/2 top-4 z-0 hidden w-[88%] -translate-x-1/2 sm:block"
              viewBox="0 0 1000 80"
              fill="none"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <path
                d="M0 40 C 62 14, 125 14, 188 40 S 312 66, 375 40 S 500 14, 562 40 S 688 66, 750 40 S 875 14, 1000 40"
                stroke="rgba(148,163,184,0.75)"
                strokeWidth="1.5"
                strokeDasharray="5 7"
                strokeLinecap="round"
              />
            </svg>

            <div ref={stepsReveal.ref as React.RefObject<HTMLDivElement>} className="grid gap-8 sm:grid-cols-4 sm:gap-4">
              {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, i) => (
                <div key={title} style={stepsReveal.itemStyle(i)} className="group text-center">
                  <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white">
                    <span className="absolute inset-0 rounded-full bg-[var(--dogshift-blue-pin)] ring-1 ring-[var(--dogshift-blue-pin-solid)] transition-transform duration-300 group-hover:scale-110" />
                    <Icon className="relative h-7 w-7 text-[var(--dogshift-blue)] transition-transform duration-300 group-hover:-translate-y-0.5" aria-hidden="true" />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--dogshift-blue)] text-[10px] font-bold text-white shadow-sm">
                      {step}
                    </span>
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-center">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition-all duration-200 hover:bg-[var(--dogshift-blue-hover)] hover:shadow-[0_14px_40px_-26px_rgba(2,6,23,0.35)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              Commencer maintenant
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SECURITY ──────────────────────────────────────────────────────────────────

function SecuritySection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div ref={blockReveal.ref} style={blockReveal.style} className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Sécurité &amp; confiance
          </p>
          <h2 className="mt-2 flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            <Lock className="h-6 w-6 shrink-0 text-slate-700" aria-hidden="true" />
            Une plateforme sécurisée dès le premier jour
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            DogShift est en phase pilote, avec un nombre{" "}
            <span className="font-semibold text-slate-800">volontairement limité</span> de dogsitters
            admis après un processus de{" "}
            <span className="font-semibold text-slate-800">sélection exigeant</span>. Cette approche
            nous permet de construire une plateforme fiable, responsable et orientée confiance, dès
            les premières réservations.
          </p>

          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, text: "DogShift agit comme plateforme de mise en relation sécurisée, avec paiement et support intégrés." },
              { icon: Umbrella, text: "Les dogsitters doivent disposer d'une assurance responsabilité civile valable, couvrant la garde d'animaux." },
              { icon: ShieldCheck, text: "DogShift est assuré en tant que plateforme, afin de garantir un cadre fiable et professionnel." },
              { icon: FileText, text: "Chaque réservation bénéficie d'un cadre contractuel clair entre le propriétaire et le dogsitter." },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="pt-1.5 text-sm leading-relaxed text-slate-700 sm:text-base">{text}</p>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm font-medium text-slate-500 sm:text-base">
            DogShift se construit avec exigence, transparence et responsabilité — pour une expérience
            de garde sereine et durable.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── MAP ───────────────────────────────────────────────────────────────────────

function MapSection() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Couverture
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
            Trouvez des dogsitters autour de vous
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
            Explorez la carte pour voir les dogsitters disponibles près de chez vous.
          </p>
        </div>
        <MapPreview embedded previewHeightClass="h-[260px] w-full sm:h-[340px]" />
      </div>
    </section>
  );
}

// ── BECOME A SITTER ───────────────────────────────────────────────────────────

function BenefitCard({ label, icon }: { label: string; icon: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <li
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-row items-center justify-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-left text-blue-100 sm:flex-col sm:items-center sm:justify-start sm:gap-0 sm:px-4 sm:pt-6 sm:pb-5 cursor-default"
      style={{
        transition: "transform 300ms cubic-bezier(0.34,1.56,0.64,1), background-color 300ms ease, border-color 300ms ease, box-shadow 300ms ease",
        transform: hovered ? "translateY(-4px)" : "translateY(0px)",
        backgroundColor: hovered ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
        borderColor: hovered ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
        boxShadow: hovered ? "0 12px 40px -10px rgba(0,0,0,0.40)" : "none",
      }}
    >
      <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-400 sm:hidden" aria-hidden="true" />
      <div className="hidden sm:flex h-10 w-10 items-center justify-center">
        <img
          src={icon}
          alt=""
          aria-hidden="true"
          style={{
            width: "36px",
            height: "36px",
            transition: "transform 300ms cubic-bezier(0.34,1.56,0.64,1)",
            transform: hovered ? "scale(1.18)" : "scale(1)",
          }}
        />
      </div>
      <span className="text-[13px] font-medium leading-snug sm:mt-3 sm:text-sm sm:text-center">{label}</span>
    </li>
  );
}

function BecomeSitterSection() {
  const reveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-[var(--dogshift-blue)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div ref={reveal.ref} style={reveal.style} className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-200">
            Rejoignez DogShift
          </p>
          <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Devenez dogsitter et partagez votre passion
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-blue-100/90 sm:text-lg">
            Rejoignez une plateforme premium construite avec exigence. Créez votre profil, fixez vos
            tarifs et accueillez des chiens près de chez vous.
          </p>

          <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-3 sm:gap-4">
            {[
              { label: "Profil gratuit, activation rapide", icon: "/caret-forward-circle-outline.svg" },
              { label: "Fixez vos propres tarifs et horaires", icon: "/compose.svg" },
              { label: "Support et accompagnement DogShift", icon: "/badge-help.svg" },
            ].map(({ label, icon }) => (
              <BenefitCard key={label} label={label} icon={icon} />
            ))}
          </ul>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/devenir-dogsitter"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--dogshift-blue)] shadow-lg shadow-[rgba(2,6,23,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Postuler maintenant
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/become-sitter/access"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-medium text-white/85 transition-all duration-200 hover:border-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Déjà dogsitter ? Accès sitter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── WHY DOGSHIFT ──────────────────────────────────────────────────────────────

function WhyDogShiftSection() {
  const whyHeaderReveal = useRevealOnce({ repeat: true });
  const cardsReveal = useStaggerReveal(4, { step: 80, repeat: true });
  const forYouReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="grid gap-16 sm:gap-20">
          <div>
            <div ref={whyHeaderReveal.ref} style={whyHeaderReveal.style}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
                Notre différence
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Pourquoi choisir DogShift ?
              </h2>
            </div>

            <div ref={cardsReveal.ref as React.RefObject<HTMLDivElement>} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: BadgeCheck, title: "Sélection rigoureuse", desc: "Un nombre volontairement limité de dogsitters, sélectionnés avec soin en phase pilote." },
                { icon: UserCheck, title: "Profils vérifiés", desc: "Informations vérifiées et profils détaillés pour choisir en toute confiance." },
                { icon: Wallet, title: "Paiement sécurisé", desc: "Paiement sécurisé et cadre contractuel clair dès la première réservation." },
                { icon: MapPin, title: "Plateforme suisse", desc: "Plateforme suisse, locale et responsable, centrée sur la relation humaine." },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div key={title} style={cardsReveal.itemStyle(i)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.14)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-42px_rgba(2,6,23,0.20)]">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div ref={forYouReveal.ref} style={forYouReveal.style}>
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.12)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
                C&apos;est fait pour vous
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                DogShift est fait pour vous si…
              </h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Vous cherchez un dogsitter de confiance, pas simplement disponible",
                  "Vous privilégiez une relation locale, humaine et transparente",
                  "Vous voulez une plateforme sécurisée, claire et responsable",
                  "Vous souhaitez éviter les profils flous et les mauvaises surprises",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                    <p className="text-sm leading-relaxed text-slate-700 sm:text-base">{item}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  { q: "DogShift est-il une pension pour chiens\u00A0?", a: "Non. DogShift est une plateforme de mise en relation entre propriétaires et dogsitters indépendants, pour une garde personnalisée et adaptée à chaque chien." },
  { q: "Comment sont sélectionnés les dogsitters\u00A0?", a: "Chaque dogsitter passe par un processus de sélection et doit fournir des informations claires — dont la vérification du casier judiciaire — avant d'être accepté sur la plateforme." },
  { q: "Que se passe-t-il en cas de problème\u00A0?", a: "DogShift agit comme intermédiaire sécurisé, avec un cadre contractuel et un support intégré pour accompagner les utilisateurs en cas de difficulté." },
  { q: "DogShift est-il disponible dans ma ville\u00A0?", a: "DogShift se développe progressivement en Suisse romande — Lausanne, Genève, Montreux, Vevey, Nyon et Morges. D'autres villes seront ajoutées prochainement." },
] as const;

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const reveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div ref={reveal.ref} style={reveal.style} className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Questions fréquentes
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Vous avez des questions ?
          </h2>

          <div className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-50px_rgba(2,6,23,0.10)]">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--dogshift-blue)]"
                  aria-expanded={openIndex === i}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={
                      "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200" +
                      (openIndex === i ? " rotate-180" : "")
                    }
                    aria-hidden="true"
                  />
                </button>
                {openIndex === i ? (
                  <div className="px-6 pb-5">
                    <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{item.a}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Vous ne trouvez pas la réponse ?{" "}
            <Link href="/help" className="font-semibold text-[var(--dogshift-blue)] underline-offset-4 hover:underline">
              Contactez-nous
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── CITIES SEO ────────────────────────────────────────────────────────────────

const CITIES = [
  { label: "Dog sitter Lausanne", href: "/dog-sitter-lausanne" },
  { label: "Dog sitter Montreux", href: "/dog-sitter-montreux" },
  { label: "Dog sitter Vevey", href: "/dog-sitter-vevey" },
  { label: "Dog sitter Nyon", href: "/dog-sitter-nyon" },
  { label: "Dog sitter Morges", href: "/dog-sitter-morges" },
  { label: "Dog sitter Genève", href: "/dog-sitter-geneve" },
] as const;

function CitiesSection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div ref={blockReveal.ref} style={blockReveal.style} className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Couverture géographique
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Trouver un dogsitter près de chez vous
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            DogShift se développe progressivement en Suisse romande. Découvrez nos services
            disponibles près de chez vous.
          </p>

          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
            {CITIES.map((city) => (
              <li key={city.href}>
                <Link
                  href={city.href}
                  className="block py-2 text-sm font-medium text-slate-600 underline-offset-4 transition-colors duration-150 hover:text-[var(--dogshift-blue)] hover:underline"
                >
                  {city.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── COMMUNITY ─────────────────────────────────────────────────────────────────

function CommunitySection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div id="contribution" className="mx-auto max-w-5xl">
          <div ref={blockReveal.ref} style={blockReveal.style} className="flex flex-col gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
                Communauté
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Soutenir le lancement de DogShift
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                DogShift est en phase pilote, construite de manière indépendante et responsable.
                Certaines personnes souhaitent contribuer volontairement au lancement de la
                plateforme.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Ce soutien permet d&apos;accompagner le développement, l&apos;infrastructure et les
                outils nécessaires à une expérience fiable dès le lancement officiel.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-base">
                Toute contribution est facultative et n&apos;influence en aucun cas l&apos;accès ou
                l&apos;utilisation de la plateforme.
              </p>
            </div>

            <div className="mt-2">
              <Link
                href="/contribuer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] sm:w-auto"
              >
                Contribuer au lancement
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── CAREERS ───────────────────────────────────────────────────────────────────

function CareersSection() {
  const headerReveal = useRevealOnce({ repeat: true });
  const blocksReveal = useStaggerReveal(3, { step: 140, repeat: true });

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <div ref={headerReveal.ref} style={headerReveal.style} className="text-center">
            <p className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-medium text-slate-600 shadow-sm">
              Carrières
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Travailler chez DogShift
            </h2>
          </div>

          <div ref={blocksReveal.ref as React.RefObject<HTMLDivElement>} className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-12">
            {[
              { icon: Briefcase, title: "Construire avec exigence", desc: "DogShift se construit progressivement, avec exigence et passion." },
              { icon: UserCheck, title: "Travailler avec des valeurs", desc: "Nous collaborons avec des profils partageant nos valeurs de confiance, responsabilité et qualité de service." },
              { icon: Handshake, title: "Échanger simplement", desc: "Si vous souhaitez contribuer au développement d'une plateforme suisse et humaine, nous serions ravis d'échanger." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={title} style={blocksReveal.itemStyle(i)} className="group text-center">
                <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center transition-transform duration-[250ms] ease-out group-hover:-translate-y-0.5">
                  <Icon className="h-12 w-12 text-[var(--dogshift-blue)]" aria-hidden="true" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-semibold">
            <Link href="/help" className="text-[var(--dogshift-blue)] transition-all duration-[250ms] ease-out hover:-translate-y-px hover:text-[var(--dogshift-blue-hover)]">
              Nous contacter
            </Link>
            <span className="text-slate-300" aria-hidden="true">/</span>
            <Link href="/help" className="text-[var(--dogshift-blue)] transition-all duration-[250ms] ease-out hover:-translate-y-px hover:text-[var(--dogshift-blue-hover)]">
              Découvrir les opportunités
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── ZOOTHERAPY TEASER ─────────────────────────────────────────────────────────

function ZootherapieSection() {
  const reveal = useRevealOnce({ repeat: true });
  return (
    <section ref={reveal.ref} style={reveal.style} className="flex flex-col md:flex-row h-auto md:h-[460px]">
      <div className="relative flex items-center md:w-2/5 bg-gradient-to-br from-violet-950 via-violet-800 to-indigo-700 px-8 py-14 sm:px-12 md:px-14">
        <div aria-hidden className="absolute inset-0 opacity-10" style={{backgroundImage:"radial-gradient(circle at 20% 80%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)", backgroundSize:"40px 40px"}} />
        <div className="relative z-10 max-w-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-violet-200 mb-5 border border-white/10">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Science &amp; bien-être
          </span>
          <h2 className="text-white text-2xl sm:text-3xl font-bold leading-tight">
            Votre chien vous fait du bien — le saviez-vous ?
          </h2>
          <p className="mt-4 text-violet-200 text-sm leading-relaxed">
            La zoothérapie montre que la présence d&apos;un chien réduit le stress, combat la solitude et améliore l&apos;humeur. Évaluez gratuitement votre bien-être avec votre compagnon.
          </p>
          <Link
            href="/zootherapie"
            className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-violet-800 shadow-sm transition-all duration-200 hover:bg-violet-50 active:scale-[0.98]"
          >
            Faire mon évaluation gratuite
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="relative md:w-3/5 h-64 md:h-auto">
        <img
          src="/images/zootherapie/zootherapie2.jpg"
          alt="Jeune femme serrant tendrement un golden retriever dans ses bras"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 55%" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-indigo-700/40 to-transparent" />
      </div>
    </section>
  );
}

// ── FINAL CTA ─────────────────────────────────────────────────────────────────

function FinalCTASection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div ref={blockReveal.ref} style={blockReveal.style} className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Prochaine étape
          </p>
          <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Prêt à trouver un dogsitter de confiance ?
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            Découvrez des profils locaux, sélectionnés avec soin, et réservez en toute sérénité.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/search"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition-all duration-200 hover:bg-[var(--dogshift-blue-hover)] hover:shadow-[0_14px_40px_-26px_rgba(2,6,23,0.35)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              Trouver un dogsitter
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/devenir-dogsitter"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:shadow-md active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              Devenir dogsitter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

export default function HomeBelowFold({ sitters }: { sitters: SitterPreview[] }) {
  return (
    <>
      {sitters.length > 0 && <FeaturedSittersSection sitters={sitters} />}
      <ReassuranceSection />
      <ServicesSection />
      <HowItWorksSection />
      <SecuritySection />
      <MapSection />
      <BecomeSitterSection />
      <WhyDogShiftSection />
      <FAQSection />
      <CitiesSection />
      <CommunitySection />
      <CareersSection />
      <ZootherapieSection />
      <FinalCTASection />
    </>
  );
}
