"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Briefcase, CheckCircle2, ChevronDown, FileCheck, FileText, Handshake, Lock, MapPin, Shield, ShieldCheck, Umbrella, UserCheck, UserPlus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import MapPreview from "@/components/MapPreview";

const HERO_SELECT_CLASS =
  "mt-1 block w-full appearance-none bg-transparent pr-8 text-sm font-medium text-slate-900 outline-none [-webkit-appearance:none] [-moz-appearance:none]";

function SearchBar({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const serviceOptions = useMemo(() => ["", "Promenade", "Garde", "Pension"] as const, []);
  const [service, setService] = useState<(typeof serviceOptions)[number]>(serviceOptions[0]);
  const [location, setLocation] = useState<string>("");

  const [error, setError] = useState<string>("");

  const canSearch = service.trim().length > 0 && location.trim().length > 0;

  function onSearch() {
    if (!canSearch) {
      setError("Veuillez renseigner le service et le lieu de prise en charge.");
      return;
    }
    const params = new URLSearchParams();
    if (service) params.set("service", service);
    if (location.trim()) params.set("location", location.trim());
    const query = params.toString();
    router.push(query ? `/search?${query}` : "/search");
  }

  const form = (
    <form
      className={`grid max-w-4xl gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_12px_40px_-20px_rgba(2,6,23,0.25)] transition-all duration-200 ease-out focus-within:border-slate-300 focus-within:shadow-[0_18px_60px_-40px_rgba(2,6,23,0.32)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_82%)] sm:p-3 md:grid-cols-[minmax(160px,220px)_1fr_auto] md:gap-2 ${
        embedded ? "" : "mx-auto"
      }`}
      aria-label="Recherche de service"
    >
      <div className="rounded-2xl px-3 py-2.5 sm:px-4">
        <label htmlFor="service" className="block text-xs font-semibold text-slate-700">
          Service
        </label>
        <div className="relative mt-1">
          <select
            id="service"
            name="service"
            value={service}
            onChange={(e) => {
              setService(e.target.value as (typeof serviceOptions)[number]);
              if (error) setError("");
            }}
            className={HERO_SELECT_CLASS}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {serviceOptions
              .filter((opt) => opt)
              .map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-0 inline-flex items-center text-slate-400" aria-hidden="true">
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="rounded-2xl px-3 py-2.5 sm:px-4 md:border-l md:border-slate-200">
        <label htmlFor="lieu" className="block text-xs font-semibold text-slate-700">
          Lieu
        </label>
        <input
          id="lieu"
          name="lieu"
          placeholder="ex. Genève, Lausanne"
          className="mt-1 block w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
          inputMode="text"
          autoComplete="off"
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearch();
            }
          }}
        />
      </div>

      <div className="flex items-stretch md:justify-end">
        <button
          type="button"
          onClick={onSearch}
          className="w-full whitespace-nowrap rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition-all duration-200 ease-out hover:bg-[var(--dogshift-blue-hover)] hover:shadow-[0_14px_40px_-26px_rgba(2,6,23,0.35)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] md:w-auto md:px-4"
        >
          Rechercher
        </button>
      </div>

      {error ? (
        <div className="md:col-span-3">
          <p className="text-center text-xs font-medium text-red-600/90">{error}</p>
        </div>
      ) : null}
    </form>
  );

  return (
    <section className={embedded ? undefined : "pb-0 pt-10 sm:pb-0"}>
      {embedded ? (
        form
      ) : (
        <div className="mx-auto max-w-6xl px-4 sm:px-6">{form}</div>
      )}
    </section>
  );
}

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
      { threshold: 0.14 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  // repeat is static config — intentionally excluded from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  const style = prefersReducedMotion
    ? undefined
    : {
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)",
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
      { threshold: 0.1 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  // repeat is a static config value — no need to re-run when it changes
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

function HeroPetsittingStyle() {
  return (
    <section className="relative w-full overflow-hidden">
      {/* Full-bleed background image */}
      <Image
        src="/HERO DOGSHIFT.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center max-sm:object-[35%_65%] 2xl:object-[68%_center]"
      />

      {/* Light overlay — left-weighted gradient keeps text legible while photo stays vivid on the right */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(100deg, rgba(248,250,252,0.90) 0%, rgba(248,250,252,0.78) 38%, rgba(248,250,252,0.26) 65%, rgba(248,250,252,0.06) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-20 mx-auto flex min-h-[100dvh] max-w-[1200px] items-start px-6 pt-20 pb-10 sm:items-center sm:min-h-[100svh] sm:px-8 sm:py-28 2xl:mx-0 2xl:max-w-none 2xl:items-start 2xl:pl-[8vw] 2xl:pr-12 2xl:pt-[20vh]">
        <div className="w-full max-w-[580px] 2xl:max-w-[740px]">
          <h1 className="text-[1.5rem] font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-balance sm:text-[1.85rem] sm:leading-[1.06] md:text-5xl lg:text-6xl 2xl:text-[4.5rem] 2xl:leading-[1.04]">
            Des dog-sitters de confiance,<br className="sm:hidden" /><br className="hidden 2xl:block" />
            {" "}en quelques clics.
          </h1>

          <p className="mt-3 text-[0.85rem] leading-relaxed text-slate-700 sm:mt-4 sm:text-lg 2xl:mt-6 2xl:text-xl">
            Promenade, garde, pension.<br className="sm:hidden" />
            {" "}Des profils vérifiés, proches de chez vous.
          </p>

          {/* Trust points — all screens */}
          <ul className="mt-4 flex flex-col gap-1.5 sm:mt-5 sm:gap-2.5 2xl:mt-6 2xl:gap-3">
            <li className="group flex items-center gap-2 transition-transform duration-200 ease-out hover:-translate-y-px sm:gap-2.5 2xl:gap-3">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--dogshift-blue)] transition-colors duration-200 ease-out group-hover:text-[var(--dogshift-blue-hover)] sm:h-[1.1rem] sm:w-[1.1rem] 2xl:h-5 2xl:w-5" aria-hidden="true" />
              <span className="text-[13px] font-medium text-slate-700 transition-colors duration-200 ease-out group-hover:text-slate-900 sm:text-sm sm:text-slate-800 2xl:text-base">Profils vérifiés manuellement</span>
            </li>
            <li className="group flex items-center gap-2 transition-transform duration-200 ease-out hover:-translate-y-px sm:gap-2.5 2xl:gap-3">
              <FileCheck className="h-3.5 w-3.5 shrink-0 text-[var(--dogshift-blue)] transition-colors duration-200 ease-out group-hover:text-[var(--dogshift-blue-hover)] sm:h-[1.1rem] sm:w-[1.1rem] 2xl:h-5 2xl:w-5" aria-hidden="true" />
              <span className="text-[13px] font-medium text-slate-700 transition-colors duration-200 ease-out group-hover:text-slate-900 sm:text-sm sm:text-slate-800 2xl:text-base">Casier judiciaire vérifié</span>
            </li>
            <li className="group flex items-center gap-2 transition-transform duration-200 ease-out hover:-translate-y-px sm:gap-2.5 2xl:gap-3">
              <Shield className="h-3.5 w-3.5 shrink-0 text-[var(--dogshift-blue)] transition-colors duration-200 ease-out group-hover:text-[var(--dogshift-blue-hover)] sm:h-[1.1rem] sm:w-[1.1rem] 2xl:h-5 2xl:w-5" aria-hidden="true" />
              <span className="text-[13px] font-medium text-slate-700 transition-colors duration-200 ease-out group-hover:text-slate-900 sm:text-sm sm:text-slate-800 2xl:text-base">Assurance RC incluse</span>
            </li>
          </ul>

          <div className="mt-6 flex flex-col items-start gap-2.5 sm:mt-8 sm:flex-row sm:items-center sm:gap-3 2xl:mt-10 2xl:gap-4">
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-xl px-5 py-2 text-[0.8rem] font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] [background:var(--dogshift-blue)] hover:[background:var(--dogshift-blue-hover)] sm:rounded-2xl sm:px-6 sm:py-3 sm:text-sm 2xl:px-7 2xl:py-3.5 2xl:text-base"
            >
              Trouver un dog sitter
            </Link>

            {/* Secondary CTA — desktop: ghost button */}
            <Link
              href="/devenir-dogsitter"
              className="hidden items-center justify-center rounded-2xl border border-slate-300 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_14px_40px_-26px_rgba(2,6,23,0.18)] active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] sm:inline-flex 2xl:px-7 2xl:py-3.5 2xl:text-base"
            >
              Devenir dogsitter
            </Link>

            {/* Secondary CTA — mobile: ghost button (compact) */}
            <Link
              href="/devenir-dogsitter"
              className="inline-flex items-center justify-center rounded-xl border border-slate-400/50 bg-white/55 px-5 py-2 text-[0.8rem] font-medium text-slate-800 backdrop-blur-sm transition-all duration-200 ease-out hover:bg-white/75 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] sm:hidden"
            >
              Devenir dogsitter
            </Link>
          </div>

          {/* SearchBar — desktop only */}
          <div className="mt-8 hidden gap-5 sm:grid">
            <SearchBar embedded />
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileSearchIntroSection() {
  return (
    <section className="bg-slate-50 pb-14 pt-1 sm:hidden">
      <div className="mx-auto max-w-[560px] px-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recherche</p>
          <h2 className="mt-2 text-balance text-xl font-semibold tracking-tight text-slate-900">Trouvez le bon dogsitter, sans friction</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Renseignez le service et votre lieu pour découvrir les profils disponibles autour de vous.
          </p>
          <div className="mt-5">
            <SearchBar embedded />
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-medium text-slate-700">Vous souhaitez rejoindre DogShift comme dogsitter ?</p>
            <Link href="/devenir-dogsitter" className="mt-3 inline-flex text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4">
              Devenir dogsitter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function MapSection() {
  return (
    <section className="relative bg-slate-50 pb-16 pt-14 sm:pb-20 sm:pt-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-50/0 via-slate-50/45 to-slate-50" />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mb-6 text-center">
          <p className="text-balance text-xl font-semibold text-slate-900 sm:text-2xl">
            Trouvez des dogsitters autour de vous
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-pretty text-sm text-slate-600">
            Explorez la carte pour voir les dogsitters disponibles près de chez vous.
          </p>
        </div>
        <MapPreview embedded previewHeightClass="h-[260px] w-full sm:h-[340px]" />
      </div>
    </section>
  );
}

function HowItWorks() {
  const headerReveal = useRevealOnce({ repeat: true });
  const stepsReveal = useStaggerReveal(3, { baseDelay: 0, step: 140, repeat: true });

  return (
    <section className="pb-16 pt-14 sm:pb-20 sm:pt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div ref={headerReveal.ref} style={headerReveal.style} className="text-center">
            <h2 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Voilà comment cela fonctionne
            </h2>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
              Trouvez un dogsitter de confiance près de chez vous — ou devenez dogsitter facilement.
            </p>
          </div>

          <div className="relative mt-12">
            <svg
              className="pointer-events-none absolute left-1/2 top-3 z-0 hidden w-[88%] -translate-x-1/2 sm:block"
              viewBox="0 0 1000 80"
              fill="none"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <defs>
                <mask id="howItWorksWaveMask">
                  <rect x="0" y="0" width="1000" height="80" fill="white" />
                  <circle cx="167" cy="40" r="88" fill="black" />
                  <circle cx="500" cy="40" r="80" fill="black" />
                  <circle cx="833" cy="40" r="80" fill="black" />
                </mask>
              </defs>
              <path
                d="M0 40 C 90 12, 170 12, 250 40 S 410 68, 500 40  S 660 12, 750 40 S 910 68, 1000 40"
                stroke="rgba(148,163,184,0.9)"
                strokeWidth="2"
                strokeDasharray="6 8"
                mask="url(#howItWorksWaveMask)"
              />
            </svg>

            <div
              ref={stepsReveal.ref as React.RefObject<HTMLDivElement>}
              className="grid gap-10 sm:grid-cols-3 sm:gap-12"
            >
              <Link
                href="/search"
                style={stepsReveal.itemStyle(0)}
                className="group text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--dogshift-blue)]"
              >
                <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center transition-transform duration-250 ease-out group-hover:-translate-y-0.5">
                  <MapPin className="h-12 w-12 text-[var(--dogshift-blue)]" aria-hidden="true" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">Trouvez près de chez vous</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Indiquez votre lieu et découvrez des dogsitters disponibles à proximité.
                </p>
                <p className="mt-4 text-sm font-semibold text-[var(--dogshift-blue)] group-hover:text-[var(--dogshift-blue-hover)]">
                  Rechercher →
                </p>
              </Link>

              <div style={stepsReveal.itemStyle(1)} className="group text-center">
                <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center transition-transform duration-250 ease-out group-hover:-translate-y-0.5">
                  <BadgeCheck className="h-12 w-12 text-[var(--dogshift-blue)]" aria-hidden="true" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">Choisissez en confiance</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Profils premium, infos vérifiées et échanges simples pour décider vite.
                </p>
              </div>

              <Link
                href="/devenir-dogsitter"
                style={stepsReveal.itemStyle(2)}
                className="group text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--dogshift-blue)]"
              >
                <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center transition-transform duration-250 ease-out group-hover:-translate-y-0.5">
                  <UserPlus className="h-12 w-12 text-[var(--dogshift-blue)]" aria-hidden="true" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">Devenez dogsitter</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Créez votre profil en 3 étapes et recevez des demandes autour de vous.
                </p>
                <p className="mt-4 text-sm font-semibold text-[var(--dogshift-blue)] group-hover:text-[var(--dogshift-blue-hover)]">
                  Commencer →
                </p>
              </Link>
            </div>
          </div>

          <div className="mt-10 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
              <Handshake className="h-4 w-4 text-[var(--dogshift-blue)]" aria-hidden="true" />
              Des rencontres locales et une expérience premium.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-16">
        <div ref={blockReveal.ref} style={blockReveal.style} className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold text-slate-600">Sécurité & confiance</p>
          <h2 className="mt-3 flex items-center gap-2 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            <Lock className="h-6 w-6 text-slate-700" aria-hidden="true" />
            <span>Une plateforme sécurisée, dès le premier jour</span>
          </h2>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
            DogShift est actuellement en phase pilote, avec un nombre <span className="font-semibold text-slate-800">volontairement limité</span> de dogsitters admis sur la plateforme après un processus de <span className="font-semibold text-slate-800">sélection exigeant</span>. Cette phase nous permet de construire une plateforme fiable, responsable et orientée confiance, dès les premières réservations.
          </p>

          <ul className="mt-6 grid gap-4">
            <li className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                DogShift agit comme plateforme de mise en relation sécurisée, avec paiement et support intégrés.
              </p>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                <Umbrella className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                Les dogsitters présents sur DogShift doivent disposer d'une assurance responsabilité civile valable, couvrant la garde d'animaux.
              </p>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                DogShift est assuré en tant que plateforme, afin de garantir un cadre fiable et professionnel.
              </p>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                Chaque réservation effectuée via DogShift bénéficie d'un cadre contractuel clair entre l'owner et le dogsitter.
              </p>
            </li>
          </ul>

          <p className="mt-6 text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
            Nous travaillons activement à la mise en place d'une couverture d'assurance dédiée DogShift, qui accompagnera le lancement officiel de la plateforme.
          </p>
          <p className="mt-4 text-sm font-medium text-slate-500">
            DogShift se construit avec exigence, transparence et responsabilité — pour une expérience de garde sereine et durable.
          </p>
        </div>
      </div>
    </section>
  );
}

function CareersSection() {
  const headerReveal = useRevealOnce({ repeat: true });
  const blocksReveal = useStaggerReveal(3, { step: 140, repeat: true });

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="mx-auto w-full max-w-5xl">
          <div ref={headerReveal.ref} style={headerReveal.style} className="text-center">
            <p className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-medium text-slate-600 shadow-sm">
              Carrières
            </p>
            <h2 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Travailler chez DogShift</h2>
          </div>

          <div
            ref={blocksReveal.ref as React.RefObject<HTMLDivElement>}
            className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-12"
          >
            <div style={blocksReveal.itemStyle(0)} className="group text-center">
              <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center transition-transform duration-[250ms] ease-out group-hover:-translate-y-0.5">
                <Briefcase className="h-12 w-12 text-[var(--dogshift-blue)]" aria-hidden="true" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">Construire avec exigence</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">DogShift se construit progressivement, avec exigence et passion.</p>
            </div>

            <div style={blocksReveal.itemStyle(1)} className="group text-center">
              <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center transition-transform duration-[250ms] ease-out group-hover:-translate-y-0.5">
                <UserCheck className="h-12 w-12 text-[var(--dogshift-blue)]" aria-hidden="true" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">Travailler avec des valeurs</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Nous collaborons avec des profils partageant nos valeurs de confiance, de responsabilité et de qualité de service.
              </p>
            </div>

            <div style={blocksReveal.itemStyle(2)} className="group text-center">
              <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center transition-transform duration-[250ms] ease-out group-hover:-translate-y-0.5">
                <Handshake className="h-12 w-12 text-[var(--dogshift-blue)]" aria-hidden="true" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">Échanger simplement</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Si vous souhaitez contribuer au développement d'une plateforme suisse, humaine et orientée bien-être animal, nous serions ravis d'échanger avec vous.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-semibold">
            <Link href="/help" className="text-[var(--dogshift-blue)] transition-all duration-[250ms] ease-out hover:-translate-y-px hover:text-[var(--dogshift-blue-hover)]">
              Nous contacter
            </Link>
            <span className="text-slate-300" aria-hidden="true">
              /
            </span>
            <Link href="/help" className="text-[var(--dogshift-blue)] transition-all duration-[250ms] ease-out hover:-translate-y-px hover:text-[var(--dogshift-blue-hover)]">
              Découvrir les opportunités
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyDogShiftSection() {
  const whyHeaderReveal = useRevealOnce({ repeat: true });
  const cardsReveal = useStaggerReveal(4, { step: 80, repeat: true });
  const forYouReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="grid gap-20 sm:gap-24">
          <div>
            <div ref={whyHeaderReveal.ref} style={whyHeaderReveal.style} className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-600">Pourquoi DogShift est différent</p>
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Pourquoi choisir DogShift ?</h2>
            </div>

            <div
              ref={cardsReveal.ref as React.RefObject<HTMLDivElement>}
              className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div style={cardsReveal.itemStyle(0)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.16)] transition-[transform,box-shadow] duration-[400ms] ease-in-out hover:-translate-y-px hover:shadow-[0_26px_60px_-42px_rgba(2,6,23,0.21)]">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-900">Sélection rigoureuse</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Sélection rigoureuse des dogsitters, avec un nombre volontairement limité de profils en phase pilote.
                </p>
              </div>

              <div style={cardsReveal.itemStyle(1)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.16)] transition-[transform,box-shadow] duration-[400ms] ease-in-out hover:-translate-y-px hover:shadow-[0_26px_60px_-42px_rgba(2,6,23,0.21)]">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-900">Profils vérifiés</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Profils détaillés et informations vérifiées pour choisir en toute confiance.
                </p>
              </div>

              <div style={cardsReveal.itemStyle(2)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.16)] transition-[transform,box-shadow] duration-[400ms] ease-in-out hover:-translate-y-px hover:shadow-[0_26px_60px_-42px_rgba(2,6,23,0.21)]">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-900">Paiement sécurisé</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Paiement sécurisé et cadre contractuel clair dès la première réservation.
                </p>
              </div>

              <div style={cardsReveal.itemStyle(3)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.16)] transition-[transform,box-shadow] duration-[400ms] ease-in-out hover:-translate-y-px hover:shadow-[0_26px_60px_-42px_rgba(2,6,23,0.21)]">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-900">Plateforme suisse</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Plateforme suisse, locale et responsable, centrée sur la relation humaine.
                </p>
              </div>
            </div>
          </div>

          {/* Plateforme construite avec exigence — statique intentionnellement */}
          <section>
            <div className="mx-auto max-w-4xl">
              <p className="text-xs font-semibold text-slate-600">Phase pilote & confiance</p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Une plateforme construite avec exigence
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                <p>
                  DogShift est actuellement en phase pilote. Nous avons volontairement limité le nombre de dogsitters admis afin de construire
                  une plateforme fiable, responsable et orientée confiance.
                </p>
                <p>
                  Les profils présents sur DogShift ont été sélectionnés avec soin pour garantir une expérience de garde sereine, dès les
                  premières réservations.
                </p>
              </div>
            </div>
          </section>

          {/* DogShift est fait pour vous si */}
          <div ref={forYouReveal.ref} style={forYouReveal.style}>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.16)] sm:p-8">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">DogShift est fait pour vous si\u2026</h2>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                    Vous cherchez un dogsitter de confiance, pas simplement disponible
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                    Vous privilégiez une relation locale, humaine et transparente
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                    Vous voulez une plateforme sécurisée, claire et responsable
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                    Vous souhaitez éviter les profils flous et les mauvaises surprises
                  </p>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqReveal = useStaggerReveal(3, { step: 80, repeat: true });

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-0 sm:px-6 sm:pb-20">
        <div className="mx-auto w-full max-w-4xl">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Questions fréquentes</h2>
          <div
            ref={faqReveal.ref as React.RefObject<HTMLDivElement>}
            className="mt-6 grid gap-3"
          >
            <details style={faqReveal.itemStyle(0)} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.14)]">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 outline-none">
                <span className="flex items-center justify-between gap-4">
                  <span>DogShift est-il une pension pour chiens ?</span>
                  <span className="text-slate-400 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Non. DogShift est une plateforme de mise en relation entre propriétaires et dogsitters indépendants, pour une garde
                personnalisée et adaptée à chaque chien.
              </p>
            </details>

            <details style={faqReveal.itemStyle(1)} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.14)]">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 outline-none">
                <span className="flex items-center justify-between gap-4">
                  <span>Comment sont sélectionnés les dogsitters ?</span>
                  <span className="text-slate-400 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Chaque dogsitter passe par un processus de sélection et doit fournir des informations claires avant d'être accepté sur la
                plateforme.
              </p>
            </details>

            <details style={faqReveal.itemStyle(2)} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.14)]">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 outline-none">
                <span className="flex items-center justify-between gap-4">
                  <span>Que se passe-t-il en cas de problème ?</span>
                  <span className="text-slate-400 transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                DogShift agit comme intermédiaire sécurisé, avec un cadre contractuel et un support intégré pour accompagner les utilisateurs.
              </p>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}

function CommunitySection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-0 sm:px-6 sm:pb-20">
        <div id="contribution" className="mx-auto w-full max-w-5xl">
          <div ref={blockReveal.ref} style={blockReveal.style} className="flex flex-col gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-600">Communauté</p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Soutenir le lancement de DogShift
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                DogShift est actuellement en phase pilote, construite de manière indépendante et responsable. Certaines personnes souhaitent
                contribuer volontairement au lancement de la plateforme.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Ce soutien permet d'accompagner le développement, l'infrastructure et les outils nécessaires à une expérience fiable dès le
                lancement officiel.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-base">
                Toute contribution est facultative et n'influence en aucun cas l'accès ou l'utilisation de la plateforme.
              </p>
            </div>

            <div className="mt-2">
              <Link
                href="/contribuer"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] sm:w-auto"
              >
                Contribuer au lancement
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTASection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-0 sm:px-6 sm:pb-20">
        <div ref={blockReveal.ref} style={blockReveal.style} className="text-center">
          <p className="text-xs font-semibold text-slate-600">Prochaine étape</p>
          <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Prêt à trouver un dogsitter de confiance près de chez vous ?
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            Découvrez des profils locaux, sélectionnés avec soin, et réservez en toute sérénité.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              Trouver un dogsitter
            </Link>
            <Link
              href="/devenir-dogsitter"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              Devenir dogsitter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePageClient() {
  const mapReveal = useRevealOnce({ repeat: true });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="pb-24 md:pb-0">
        <HeroPetsittingStyle />
        <HowItWorks />
        <SecuritySection />
        <CareersSection />

        <div ref={mapReveal.ref} style={mapReveal.style}>
          <MapSection />
        </div>

        <WhyDogShiftSection />
        <FAQSection />
        <CommunitySection />
        <FinalCTASection />
      </main>
    </div>
  );
}
