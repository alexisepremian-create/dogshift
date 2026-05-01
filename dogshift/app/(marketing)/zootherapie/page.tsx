/* eslint-disable react-hooks/refs */
"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart, Brain, Leaf, CheckCircle2, Sparkles } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "success" | "error";

interface Reponses {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  q5: string;
}

// ─── Scroll-reveal hook ───────────────────────────────────────────────────────

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) { setShown(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, shown };
}

// ─── Question definitions ─────────────────────────────────────────────────────

const QUESTIONS = [
  {
    id: "q1" as const,
    label: "Combien de temps passez-vous avec votre chien chaque jour ?",
    options: ["Moins d'1h", "1 à 3h", "Plus de 3h"],
  },
  {
    id: "q2" as const,
    label: "Comment vous sentez-vous après une balade avec votre chien ?",
    options: ["Apaisé(e)", "Énergisé(e)", "Pas de différence notable"],
  },
  {
    id: "q3" as const,
    label: "Votre chien vous aide-t-il à décompresser après une journée stressante ?",
    options: ["Toujours", "Parfois", "Rarement"],
  },
  {
    id: "q4" as const,
    label: "Vous sentez-vous moins seul(e) grâce à votre chien ?",
    options: ["Oui, beaucoup", "Un peu", "Non"],
  },
  {
    id: "q5" as const,
    label: "Quand vous partez en vacances, comment gérez-vous la garde de votre chien ?",
    options: ["Famille ou amis", "Pet-sitter professionnel", "Pension", "Ça me stresse beaucoup"],
  },
] as const;

// ─── Educational content ──────────────────────────────────────────────────────

const EDU_BLOCKS = [
  {
    icon: Brain,
    color: "text-violet-600",
    bg: "bg-violet-50",
    hoverBorder: "hover:border-violet-200",
    hoverIcon: "group-hover:bg-violet-100",
    accentBar: "bg-violet-400",
    hoverTitle: "#7c3aed",
    title: "La zoothérapie, une science du lien",
    body: "La zoothérapie désigne l'ensemble des approches thérapeutiques faisant intervenir l'animal dans un but de soin, de réhabilitation ou de bien-être. Des études cliniques publiées dans des revues comme Frontiers in Psychology montrent que la présence d'un chien réduit le taux de cortisol — l'hormone du stress — et augmente la sécrétion d'ocytocine, souvent appelée « hormone du câlin ». Ce n'est pas qu'une sensation : c'est mesurable.",
  },
  {
    icon: Heart,
    color: "text-rose-500",
    bg: "bg-rose-50",
    hoverBorder: "hover:border-rose-200",
    hoverIcon: "group-hover:bg-rose-100",
    accentBar: "bg-rose-400",
    hoverTitle: "#e11d48",
    title: "Un compagnon qui veille sur votre santé mentale",
    body: "La routine quotidienne imposée par un chien — les promenades, les repas, les jeux — structure le temps et donne un sentiment de purpose, particulièrement bénéfique en période de stress ou d'isolement. Des recherches de l'Université de Liverpool ont montré que les propriétaires de chiens présentaient une activité physique 22 % supérieure à celle des non-propriétaires, et des niveaux d'anxiété significativement plus bas. Votre chien vous soigne sans le savoir.",
  },
  {
    icon: Leaf,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    hoverBorder: "hover:border-emerald-200",
    hoverIcon: "group-hover:bg-emerald-100",
    accentBar: "bg-emerald-400",
    hoverTitle: "#059669",
    title: "Le bien-être de votre chien, reflet du vôtre",
    body: "Un chien qui se sent en sécurité, stimulé et aimé transmet cette sérénité à son maître. À l'inverse, un chien anxieux ou sous-stimulé peut amplifier le stress ambiant du foyer. Investir dans le bien-être de votre compagnon — que ce soit via des promenades régulières, une garde de qualité ou une alimentation adaptée — c'est aussi investir dans le vôtre. Le lien humain-animal est une rue à double sens.",
  },
] as const;

// ─── Page component ───────────────────────────────────────────────────────────

export default function ZootherapiePage() {
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [reponses, setReponses] = useState<Partial<Reponses>>({});
  const [status, setStatus] = useState<Status>("idle");

  const allAnswered =
    Object.keys(reponses).length === QUESTIONS.length && prenom.trim() && email.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAnswered || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/agents/zootherapie-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prenom: prenom.trim(), email: email.trim(), reponses }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  // Reveal refs
  const heroReveal   = useReveal(0);
  const imageReveal  = useReveal(0.05);
  const scienceReveal = useReveal(0.08);
  const splitReveal  = useReveal(0.08);
  const formReveal   = useReveal(0.06);

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-white pt-8 pb-10 sm:pt-12 sm:pb-14 overflow-hidden">
        {/* Decorative blob */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-violet-100/50 blur-3xl"
        />

        <div
          ref={heroReveal.ref}
          className={`mx-auto max-w-5xl px-4 sm:px-6 relative transition-all duration-700 ease-out ${
            heroReveal.shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="md:grid md:grid-cols-2 md:gap-14 md:items-center">

            {/* Left — text */}
            <div>
              {/* Badge — icon instead of emoji */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3.5 py-1 text-xs font-semibold tracking-wide text-violet-700 mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                Évaluation gratuite
              </span>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl leading-tight">
                Évaluez votre bien-être
                <br />
                <span className="text-violet-600">avec votre chien</span>
              </h1>

              <p className="mt-5 text-base sm:text-lg text-slate-500 leading-relaxed">
                Il vous regarde, vous attendit, vous accueille — sans condition, sans jugement.
                Découvrez en quelques questions comment votre lien unique avec lui nourrit votre
                équilibre intérieur, et recevez une évaluation personnalisée par notre IA spécialisée
                en zoothérapie.
              </p>

              <a
                href="#evaluation"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-violet-700 hover:shadow-lg transition-all"
              >
                Commencer l&apos;évaluation
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Right — hero image */}
            <div className="hidden md:block">
              <div className="relative h-[520px] rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="/images/zootherapie/zootherapie1.jpg"
                  alt="Fillette avec un chiot blanc sous une lumière dorée"
                  fill
                  priority
                  className="object-cover object-center"
                />
                {/* Subtle gradient at bottom */}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Editorial full-width image break ─────────────────────────────── */}
      <div
        ref={imageReveal.ref}
        className={`relative overflow-hidden h-[420px] md:h-[540px] transition-all duration-1000 ease-out ${
          imageReveal.shown ? "opacity-100" : "opacity-0"
        }`}
      >
        <Image
          src="/images/zootherapie/zootherapie2.jpg"
          alt="Jeune femme serrant tendrement un golden retriever dans ses bras"
          fill
          priority
          className="object-cover"
          style={{ objectPosition: "center 65%" }}
        />
        {/* Gradient overlay — heavier on left for legibility */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-transparent" />

        {/* Floating editorial text */}
        <div className="absolute inset-0 flex items-end md:items-center pb-10 md:pb-0">
          <div className="mx-auto max-w-5xl px-6 w-full">
            <div className="max-w-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px w-8 bg-violet-400" />
                <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">
                  Science &amp; bien-être
                </span>
              </div>
              <p className="text-white text-3xl md:text-4xl font-bold leading-tight mb-4">
                17 % de cortisol en moins après un câlin avec votre chien.
              </p>
              <p className="text-white/55 text-sm italic">
                Source : Frontiers in Psychology, 2019
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Educational content ──────────────────────────────────────────── */}
      <section className="bg-white py-16 sm:py-24">
        <div
          ref={scienceReveal.ref}
          className={`mx-auto max-w-5xl px-4 sm:px-6 transition-all duration-700 ease-out ${
            scienceReveal.shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Ce que la science dit du lien humain-animal
            </h2>
            <p className="mt-3 text-slate-500 text-sm sm:text-base max-w-xl mx-auto">
              Derrière chaque câlin, chaque promenade, chaque regard échangé — une biologie du bien-être.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {EDU_BLOCKS.map(({ icon: Icon, color, bg, hoverBorder, hoverIcon, accentBar, hoverTitle, title, body }, i) => (
              <div
                key={title}
                className={`group relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ${hoverBorder} hover:shadow-xl hover:-translate-y-2 transition-all duration-300 overflow-hidden cursor-default`}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                {/* Colored accent bar on hover */}
                <div className={`absolute left-0 top-0 w-1 h-full ${accentBar} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${bg} ${hoverIcon} group-hover:scale-110 transition-all duration-300 mb-4`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3
                  className="font-semibold text-slate-900 mb-2 text-sm sm:text-base transition-colors duration-300 group-hover:text-[var(--hover-color)]"
                  style={{ ["--hover-color" as string]: hoverTitle }}
                >
                  {title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          {/* Horizontal split — zootherapie3 */}
          <div
            ref={splitReveal.ref}
            className={`mt-16 flex flex-col md:flex-row md:items-center overflow-hidden rounded-2xl shadow-xl transition-all duration-700 ease-out ${
              splitReveal.shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            {/* Image (left, 40%) */}
            <div className="relative h-[280px] md:h-[400px] md:w-2/5 flex-shrink-0">
              <Image
                src="/images/zootherapie/zootherapie3.jpg"
                alt="Homme détendu se reposant aux côtés de son golden retriever"
                fill
                className="object-cover object-center rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none"
              />
            </div>
            {/* Editorial text (right, 60%) */}
            <div className="flex flex-col justify-center bg-slate-50 px-8 py-10 md:w-3/5 md:pl-12 md:pr-10 rounded-b-2xl md:rounded-r-2xl md:rounded-bl-none">
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Un lien qui se vit au quotidien
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Chaque promenade, chaque moment de silence partagé, chaque regard échangé — tout cela construit quelque chose de profond entre vous et votre chien. La zoothérapie ne se pratique pas uniquement en cabinet : elle se vit, chaque jour, dans la relation que vous entretenez avec lui.
              </p>
              <p className="mt-5 text-sm text-slate-400 italic">
                Ce regard. Cette présence. Sans condition.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── Evaluation form ───────────────────────────────────────────────── */}
      <section id="evaluation" className="bg-slate-50 py-16 sm:py-24">
        <div
          ref={formReveal.ref}
          className={`mx-auto max-w-5xl px-4 sm:px-6 transition-all duration-700 ease-out ${
            formReveal.shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Votre évaluation personnalisée
            </h2>
            <p className="mt-3 text-slate-500 text-sm sm:text-base">
              Répondez aux 5 questions ci-dessous. Claude, notre IA spécialisée, analyse vos
              réponses et vous envoie une évaluation sur mesure par email.
            </p>
          </div>

          {status === "success" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Merci {prenom} !
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Votre évaluation personnalisée arrive dans quelques instants dans votre boîte mail.
                Prenez soin de vous — et de lui.
              </p>
              <Link
                href="/search"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition-colors"
              >
                Trouver un dog-sitter de confiance
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl shadow-xl md:flex">

              {/* Image column */}
              <div className="hidden md:block md:w-2/5 relative min-h-[500px]">
                <Image
                  src="/images/zootherapie/zootherapie5.jpg"
                  alt="Jeune femme tenant tendrement un golden retriever contre elle"
                  fill
                  className="object-cover object-center"
                />
              </div>

              {/* Form column */}
              <div className="md:w-3/5">
            <form
              onSubmit={(e) => { void handleSubmit(e); }}
              className="bg-white h-full p-8 sm:p-10 space-y-8"
            >
              {/* Prenom + email */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom</label>
                  <input
                    type="text"
                    required
                    placeholder="Votre prénom"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition"
                  />
                </div>
              </div>

              {/* Questions */}
              {QUESTIONS.map(({ id, label, options }) => (
                <fieldset key={id}>
                  <legend className="text-sm font-semibold text-slate-800 mb-3 leading-snug">
                    {label}
                  </legend>
                  <div className="flex flex-col gap-2">
                    {options.map((opt) => {
                      const checked = reponses[id] === opt;
                      return (
                        <label
                          key={opt}
                          className={`flex items-center gap-3 cursor-pointer rounded-xl border px-4 py-3 text-sm transition-all duration-200 ${
                            checked
                              ? "border-violet-400 bg-violet-50 text-violet-800 font-medium shadow-sm"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-300 hover:bg-violet-50/60 hover:shadow-sm"
                          }`}
                        >
                          <input
                            type="radio"
                            name={id}
                            value={opt}
                            checked={checked}
                            onChange={() => setReponses((prev) => ({ ...prev, [id]: opt }))}
                            className="accent-violet-600"
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              {/* Error */}
              {status === "error" && (
                <p className="text-sm text-rose-600 text-center">
                  Une erreur est survenue. Veuillez réessayer.
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!allAnswered || status === "loading"}
                className="w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-violet-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {status === "loading" ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Analyse en cours…
                  </>
                ) : (
                  <>
                    Recevoir mon évaluation personnalisée
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-400">
                Vos données sont traitées avec soin et ne sont jamais revendues.
              </p>
            </form>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────────────────────── */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <p className="text-slate-500 text-sm">
            Vous cherchez un dog-sitter de confiance pour votre compagnon ?
          </p>
          <Link
            href="/search"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            Voir les dog-sitters vérifiés
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

    </div>
  );
}
