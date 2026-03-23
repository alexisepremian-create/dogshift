import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, CreditCard, type LucideIcon, ShieldCheck, UserCheck } from "lucide-react";

type StepItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type HowItWorksSchemaProps = {
  title: string;
  intro: string;
  steps: readonly StepItem[];
  note: string;
  moreHref?: string;
  moreLabel?: string;
};

const CARD_BASE =
  "group relative z-10 overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] backdrop-blur-[2px] transition hover:-translate-y-0.5 hover:shadow-[0_18px_60px_-46px_rgba(2,6,23,0.22)] sm:p-6";

export const OWNER_HOW_IT_WORKS_CONTENT = {
  title: "Comment fonctionnent les réservations",
  intro: "Un rappel simple pour comprendre le flow de réservation, de confirmation et de remboursement.",
  note: "Si votre réservation n’est pas acceptée à temps (24h avant), elle est automatiquement annulée et remboursée.",
  moreHref: "/help",
  moreLabel: "En savoir plus",
  steps: [
    {
      title: "Réservez en quelques clics",
      description: "Choisissez un dogsitter, sélectionnez la date et envoyez votre demande.",
      icon: CalendarDays,
    },
    {
      title: "Paiement sécurisé",
      description: "Votre paiement est effectué au moment de la réservation pour garantir le créneau.",
      icon: CreditCard,
    },
    {
      title: "Confirmation du dogsitter",
      description: "Le dogsitter doit accepter votre demande avant la date prévue.",
      icon: UserCheck,
    },
    {
      title: "Service confirmé ou remboursement automatique",
      description: "Si le dogsitter accepte, la réservation est confirmée. Sinon, elle est annulée et remboursée automatiquement.",
      icon: ShieldCheck,
    },
  ],
} as const;

export const SITTER_HOW_IT_WORKS_CONTENT = {
  title: "Comment fonctionnent les demandes",
  intro: "Un aperçu clair du flow côté dogsitter pour éviter toute confusion sur les délais et confirmations.",
  note: "Vous devez répondre avant la date prévue (minimum 24h avant), sinon la demande expire automatiquement.",
  moreHref: "/help",
  moreLabel: "En savoir plus",
  steps: [
    {
      title: "Recevez une demande",
      description: "Vous recevez une demande avec les détails du service.",
      icon: CalendarDays,
    },
    {
      title: "Acceptez rapidement",
      description: "Acceptez la demande pour confirmer la réservation.",
      icon: CheckCircle2,
    },
    {
      title: "Réservation confirmée",
      description: "Une fois acceptée, la réservation est validée et le client est informé.",
      icon: UserCheck,
    },
    {
      title: "Attention aux délais",
      description: "Si vous ne répondez pas à temps, la réservation est annulée automatiquement et le client est remboursé.",
      icon: AlertTriangle,
    },
  ],
} as const;

export default function HowItWorksSchema({ title, intro, steps, note, moreHref, moreLabel = "En savoir plus" }: HowItWorksSchemaProps) {
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)]" aria-hidden="true" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[var(--dogshift-blue)]">Comment ça fonctionne</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{intro}</p>
        </div>
        {moreHref ? (
          <Link href={moreHref} className="inline-flex items-center text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900">
            {moreLabel}
          </Link>
        ) : null}
      </div>

      <div className="relative z-10 mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article key={step.title} className={CARD_BASE}>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--dogshift-blue),white_88%)] text-[var(--dogshift-blue)] ring-1 ring-[color-mix(in_srgb,var(--dogshift-blue),white_70%)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-500 shadow-sm">
                  {index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
            </article>
          );
        })}
      </div>

      <div className="relative z-10 mt-6 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-4 text-sm text-amber-900 shadow-sm backdrop-blur-[2px] sm:px-5">
        <p className="font-semibold">Bon à savoir</p>
        <p className="mt-1 leading-6">{note}</p>
      </div>
    </section>
  );
}
