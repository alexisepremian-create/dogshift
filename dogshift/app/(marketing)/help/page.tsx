import { HelpCircle, Mail, ShieldCheck, User, Users } from "lucide-react";

import HelpContactForm from "@/components/HelpContactForm";

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Centre d’aide</h1>
      <h2 className="mt-3 text-base font-medium text-slate-600 sm:text-lg">
        Tout ce qu’il faut savoir pour utiliser DogShift en toute confiance.
      </h2>

      <div className="mt-10 grid gap-6">
        <section className="rounded-3xl bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">DogShift en phase pilote</h3>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            <p>
              DogShift est actuellement en phase pilote, avec un nombre volontairement limité de dogsitters admis sur la plateforme après un processus de sélection exigeant.
            </p>
            <p>
              Cette phase nous permet de tester, ajuster et renforcer l’expérience DogShift avant le lancement officiel, tout en garantissant un cadre sérieux et sécurisé dès les premières réservations.
            </p>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">Questions fréquentes</h3>
          </div>

          <dl className="mt-5 grid gap-5">
            <div>
              <dt className="text-sm font-semibold text-slate-900">Qui peut utiliser DogShift ?</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-base">
                DogShift est ouvert à tous les propriétaires de chiens.
                <br />
                Les dogsitters, quant à eux, sont admis sur la plateforme uniquement après avoir répondu à nos critères de sélection.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-900">Comment sont sélectionnés les dogsitters ?</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-base">
                Les dogsitters sont admis sur la plateforme après vérification de leur profil et de leur fiabilité.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-900">Les paiements sont-ils sécurisés ?</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-base">
                Oui. Toutes les réservations et paiements passent exclusivement par la plateforme DogShift.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-900">Y a-t-il une assurance ?</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-base">
                DogShift est assuré en tant que plateforme. Les dogsitters doivent disposer d’une assurance responsabilité civile valable. Une couverture dédiée DogShift est en cours de mise en place.
              </dd>
            </div>
          </dl>
        </section>

        <div className="grid gap-6 sm:grid-cols-2">
          <section className="rounded-3xl bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                <User className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Vous êtes propriétaire de chien</h3>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              DogShift vous permet de trouver des dogsitters fiables, sélectionnés et évalués, dans un cadre clair et sécurisé.
            </p>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Vous êtes dogsitter</h3>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              DogShift valorise les dogsitters sérieux et responsables, en leur offrant une plateforme professionnelle pour proposer leurs services en toute transparence.
            </p>
          </section>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">Besoin d’aide ?</h3>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            Une question, un doute ou un problème ?
            <br />
            Notre équipe est disponible pour vous accompagner.
          </p>

          <HelpContactForm />
        </section>
      </div>
    </main>
  );
}
