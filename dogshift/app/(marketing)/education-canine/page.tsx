import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Dog, GraduationCap, HeartHandshake, Mail, ShieldCheck, Sparkles } from "lucide-react";

const title = "Éducation canine certifiée DogShift | Partenaire officielle DogShift";
const description =
  "Découvrez l’éducatrice canine partenaire officielle de DogShift, référente dédiée à l’éducation canine avec une approche professionnelle, bienveillante et premium.";
const canonical = "https://dogshift.ch/education-canine";

export const metadata: Metadata = {
  title,
  description,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical,
  },
  openGraph: {
    title,
    description,
    url: canonical,
    type: "website",
    locale: "fr_CH",
    siteName: "DogShift",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const differentiators = [
  {
    title: "Approche professionnelle et bienveillante",
    description:
      "Chaque accompagnement est pensé pour répondre au rythme du chien, avec une lecture fine de son comportement et des besoins concrets de la situation.",
    icon: GraduationCap,
  },
  {
    title: "Accompagnement centré sur le chien",
    description:
      "Ici, l’éducation canine concerne directement le chien et sa progression. Il ne s’agit pas d’une formation destinée aux adultes.",
    icon: Dog,
  },
  {
    title: "Référente officielle DogShift",
    description:
      "DogShift recommande une seule éducatrice canine partenaire pour garantir une qualité constante, une vision claire et une expérience cohérente.",
    icon: BadgeCheck,
  },
  {
    title: "Cadre premium et rassurant",
    description:
      "Le positionnement DogShift repose sur la confiance, la clarté et l’exigence. Cette page met en avant une partenaire choisie pour incarner ce niveau de qualité.",
    icon: ShieldCheck,
  },
];

const serviceHighlights = [
  "Travail éducatif directement avec le chien",
  "Approche structurée, calme et individualisée",
  "Intervention recommandée par DogShift pour les besoins d’éducation canine",
];

const differenceRows = [
  {
    title: "Dogsitting DogShift",
    text: "Promenade, garde et pension répondent à des besoins de prise en charge, de présence et d’organisation au quotidien.",
  },
  {
    title: "Éducation canine DogShift",
    text: "L’éducation canine concerne un accompagnement dédié au comportement, à l’apprentissage et à l’équilibre du chien. C’est un service expert à part, distinct d’une prestation de dogsitting.",
  },
];

export default function EducationCaninePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Partenaire officielle DogShift</p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Éducation canine certifiée DogShift
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
              DogShift recommande une seule éducatrice canine partenaire officielle pour accompagner les chiens dans un cadre professionnel,
              rassurant et cohérent avec l’univers premium de la plateforme.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                <Sparkles className="h-4 w-4 text-[var(--dogshift-blue)]" aria-hidden="true" />
                Référente DogShift en éducation canine
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                <HeartHandshake className="h-4 w-4 text-[var(--dogshift-blue)]" aria-hidden="true" />
                Accompagnement direct du chien
              </span>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="mailto:support@dogshift.ch?subject=Demande%20d%E2%80%99accompagnement%20-%20%C3%89ducation%20canine%20DogShift"
                className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                Demander un accompagnement
              </a>
              <a
                href="mailto:support@dogshift.ch?subject=Prise%20de%20contact%20-%20%C3%89ducation%20canine%20DogShift"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                Prendre contact
              </a>
              <Link
                href="/help"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                Contacter DogShift
              </Link>
            </div>
          </div>

          <aside className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-48px_rgba(2,6,23,0.35)]">
            <div className="relative aspect-[4/5] w-full bg-slate-100">
              <img
                src="https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80"
                alt="Éducatrice canine avec un border collie"
                className="h-full w-full object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent p-6 sm:p-8">
                <div className="max-w-sm rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Partenariat exclusif</p>
                  <p className="mt-2 text-lg font-semibold text-white">L’éducation canine certifiée DogShift passe exclusivement par notre partenaire officielle.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.16)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Notre éducatrice canine partenaire</p>
              <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Une experte dédiée à l’éducation des chiens, dans un cadre clair et premium
              </h2>
              <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                <p>
                  Cette page n’est pas une fiche dogsitter. Elle présente la partenaire officielle DogShift pour l’éducation canine : une référente dédiée,
                  choisie pour la qualité de son approche, son professionnalisme et sa capacité à intervenir directement auprès des chiens.
                </p>
                <p>
                  Son rôle consiste à accompagner les chiens sur les enjeux éducatifs avec une méthode sérieuse, progressive et bienveillante. Elle ne propose
                  pas de formation pour adultes : son intervention est centrée sur le chien et sur l’équilibre recherché dans la relation au quotidien.
                </p>
                <p>
                  Au sein de DogShift, elle occupe une place à part. C’est la partenaire officielle recommandée pour l’éducation canine, afin de garantir une
                  expérience homogène, crédible et pleinement alignée avec l’exigence de la marque.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Ce que cela signifie concrètement</p>
              <div className="mt-5 grid gap-3">
                {serviceHighlights.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-[color-mix(in_srgb,var(--dogshift-blue),white_72%)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_94%)] p-4">
                <p className="text-sm font-semibold text-slate-900">Référente exclusive DogShift</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  Pour l’éducation canine certifiée DogShift, nous avons fait le choix d’une seule partenaire officielle. Ce positionnement volontaire permet de
                  préserver un niveau de confiance, de cohérence et de qualité à la hauteur de l’expérience attendue.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Pourquoi passer par elle</p>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Une partenaire recommandée pour offrir une référence claire en éducation canine
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {differentiators.map((item) => {
                const Icon = item.icon;
                return (
                  <section key={item.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)]">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {differenceRows.map((item, index) => (
              <section
                key={item.title}
                className={
                  index === 1
                    ? "rounded-3xl border border-[color-mix(in_srgb,var(--dogshift-blue),white_70%)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_95%)] p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8"
                    : "rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8"
                }
              >
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{item.text}</p>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.16)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Prendre contact</p>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Un besoin d’accompagnement éducatif pour votre chien ?
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Si vous recherchez un accompagnement sérieux, structuré et directement centré sur votre chien, vous pouvez contacter DogShift pour être mis en relation
              avec notre éducatrice canine partenaire officielle.
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Contact DogShift</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <a href="mailto:support@dogshift.ch" className="font-semibold text-slate-900 hover:text-[var(--dogshift-blue)]">
                    support@dogshift.ch
                  </a>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Nous orientons les demandes d’éducation canine vers la partenaire officielle DogShift dans le cadre prévu pour ce service.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
                <a
                  href="mailto:support@dogshift.ch?subject=Contact%20-%20%C3%89ducation%20canine%20DogShift"
                  className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                >
                  Contacter
                </a>
                <Link
                  href="/help"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  <span>Passer par DogShift</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
