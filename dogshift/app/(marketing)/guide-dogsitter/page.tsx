import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, ArrowRight, Shield, Star, Heart } from "lucide-react";

export const metadata: Metadata = {
  title: "Guide gratuit : 5 erreurs à éviter quand vous confiez votre chien – DogShift",
  description:
    "Découvrez les 5 erreurs les plus fréquentes des propriétaires de chiens et comment les éviter pour confier votre chien en toute sérénité.",
  robots: { index: false, follow: false },
};

const tips = [
  {
    number: "01",
    icon: Shield,
    color: "violet",
    title: "Ne pas vérifier les références du dog-sitter",
    problem:
      "La plupart des propriétaires choisissent un dog-sitter uniquement sur la base de photos ou d'une biographie symphatique. C'est une erreur courante qui peut mener à de mauvaises surprises.",
    solution:
      "Avant de confier votre chien, demandez toujours des avis vérifiés et des références. Sur DogShift, chaque sitter est vérifié manuellement par notre équipe avant d'être publié sur la plateforme.",
    checklist: [
      "Consultez les avis laissés par d'autres propriétaires",
      "Vérifiez que le profil est certifié par DogShift",
      "N'hésitez pas à demander des références directes",
    ],
  },
  {
    number: "02",
    icon: Star,
    color: "amber",
    title: "Choisir uniquement sur le prix",
    problem:
      "Opter pour le sitter le moins cher peut sembler économique, mais le prix bas cache souvent un manque d'expérience ou des conditions d'hébergement insuffisantes pour votre chien.",
    solution:
      "Le bon prix, c'est celui qui correspond à la qualité du service, à l'expérience du sitter et aux besoins spécifiques de votre chien. Comparez les prestations, pas seulement les tarifs.",
    checklist: [
      "Comparez ce qui est inclus dans le tarif (promenades, câlins, suivi photo…)",
      "Évaluez l'expérience du sitter avec votre race de chien",
      "Prenez en compte la localisation et le cadre de vie du sitter",
    ],
  },
  {
    number: "03",
    icon: Heart,
    color: "rose",
    title: "Sauter la rencontre préalable",
    problem:
      "Déposer son chien sans rencontre préalable est l'une des erreurs les plus stressantes pour l'animal. Un chien qui ne connaît pas son sitter peut développer de l'anxiété de séparation.",
    solution:
      "Organisez toujours une rencontre de présentation — idéalement chez le sitter — avant le premier séjour. C'est un moment clé pour valider la compatibilité entre votre chien et l'environnement.",
    checklist: [
      "Planifiez une visite de 30 à 60 min avant la réservation",
      "Observez la réaction de votre chien dans l'environnement du sitter",
      "Posez toutes vos questions sur les routines et les règles de la maison",
    ],
  },
  {
    number: "04",
    icon: AlertTriangle,
    color: "orange",
    title: "Oublier de partager les informations médicales",
    problem:
      "En cas d'urgence vétérinaire, un sitter qui ne connaît pas les allergies, médicaments ou antécédents de santé de votre chien peut mettre sa vie en danger par méconnaissance.",
    solution:
      "Préparez une fiche santé complète que vous remettez à chaque garde. Elle doit inclure les coordonnées de votre vétérinaire, les médicaments en cours, les allergies et tout comportement particulier.",
    checklist: [
      "Rédigez une fiche santé avec les infos essentielles",
      "Laissez les médicaments avec posologie écrite",
      "Partagez les contacts d'urgence (vétérinaire + vous-même)",
    ],
  },
  {
    number: "05",
    icon: CheckCircle2,
    color: "teal",
    title: "Ne pas définir les routines et attentes",
    problem:
      "Un chien habitué à sortir 3 fois par jour, à dormir dans la chambre ou à ne pas recevoir de nourriture humaine peut devenir anxieux si ces habitudes ne sont pas respectées.",
    solution:
      "Communiquez précisément vos attentes dès le départ. Un bon sitter adapte sa routine à celle de votre chien, pas l'inverse. Mettez-les par écrit pour éviter tout malentendu.",
    checklist: [
      "Décrivez la routine quotidienne (repas, promenades, jeux, sommeil)",
      "Précisez ce qui est interdit (canapé, certains aliments, sorties sans laisse…)",
      "Demandez des mises à jour régulières (photos, messages)",
    ],
  },
];

const colorMap: Record<string, { bg: string; ring: string; text: string; badge: string }> = {
  violet: { bg: "bg-violet-50",  ring: "ring-violet-200",  text: "text-violet-600",  badge: "bg-violet-100 text-violet-700" },
  amber:  { bg: "bg-amber-50",   ring: "ring-amber-200",   text: "text-amber-600",   badge: "bg-amber-100 text-amber-700" },
  rose:   { bg: "bg-rose-50",    ring: "ring-rose-200",    text: "text-rose-600",    badge: "bg-rose-100 text-rose-700" },
  orange: { bg: "bg-orange-50",  ring: "ring-orange-200",  text: "text-orange-600",  badge: "bg-orange-100 text-orange-700" },
  teal:   { bg: "bg-teal-50",    ring: "ring-teal-200",    text: "text-teal-600",    badge: "bg-teal-100 text-teal-700" },
};

export default function GuideDogSitterPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="bg-white border-b border-slate-100">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 mb-5">
            Guide gratuit DogShift
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-4">
            5 erreurs à éviter quand vous confiez votre chien
          </h1>
          <p className="text-lg text-slate-500 leading-relaxed max-w-xl mx-auto">
            Les conseils que nos sitters vérifiés partagent avec les propriétaires les plus sereins.
          </p>
        </div>
      </section>

      {/* Tips */}
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-8">
        {tips.map((tip) => {
          const c = colorMap[tip.color];
          const Icon = tip.icon;
          return (
            <article
              key={tip.number}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-start gap-4 p-6 pb-0">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.bg} ring-1 ${c.ring}`}>
                  <Icon size={20} className={c.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`inline-block text-xs font-bold rounded-md px-2 py-0.5 mb-2 ${c.badge}`}>
                    Erreur {tip.number}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 leading-snug">{tip.title}</h2>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Problem */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-1.5">Le problème</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{tip.problem}</p>
                </div>

                {/* Solution */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-500 mb-1.5">La solution</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{tip.solution}</p>
                </div>

                {/* Checklist */}
                <ul className={`rounded-xl ${c.bg} ring-1 ${c.ring} p-4 space-y-2`}>
                  {tip.checklist.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 size={15} className={`mt-0.5 shrink-0 ${c.text}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <div className="rounded-2xl bg-violet-600 px-8 py-10 text-center text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-200 mb-3">
            Prêt à passer à l&apos;étape suivante ?
          </p>
          <h2 className="text-2xl font-extrabold mb-3 leading-tight">
            Trouvez un dog-sitter vérifié près de chez vous
          </h2>
          <p className="text-violet-200 text-sm mb-6 max-w-sm mx-auto">
            Tous les sitters DogShift sont vérifiés manuellement. Avis réels, profils certifiés.
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-violet-700 shadow hover:bg-violet-50 transition-colors"
          >
            Voir les dog-sitters
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
