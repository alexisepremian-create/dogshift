import Link from "next/link";
import { ArrowRight, BadgeCheck, Bell, MapPin, ShieldCheck } from "lucide-react";

type CitySeoLandingPageProps = {
  cityLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  introParagraphs: string[];
  clarificationTitle: string;
  clarificationText: string;
  valueTitle?: string;
  valueItems?: Array<{
    title: string;
    description: string;
  }>;
  seoSections?: Array<{
    title: string;
    paragraphs: string[];
  }>;
  structuredData?: Record<string, unknown>;
  ctaEyebrow: string;
  ctaTitle: string;
  ctaText: string;
  primaryCta: {
    href: string;
    label: string;
  };
  secondaryCta: {
    href: string;
    label: string;
  };
  tertiaryCta: {
    href: string;
    label: string;
  };
};

export default function CitySeoLandingPage({
  cityLabel,
  heroTitle,
  heroSubtitle,
  introParagraphs,
  clarificationTitle,
  clarificationText,
  valueTitle = "Pourquoi choisir DogShift",
  valueItems = [],
  seoSections = [],
  structuredData,
  ctaEyebrow,
  ctaTitle,
  ctaText,
  primaryCta,
  secondaryCta,
  tertiaryCta,
}: CitySeoLandingPageProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      ) : null}

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-16">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold text-slate-600">DogShift · {cityLabel}</p>
            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">{heroSubtitle}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={primaryCta.href}
                className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                {primaryCta.label}
              </Link>
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                {secondaryCta.label}
              </Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.12)] sm:p-8">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">Un lancement progressif et premium</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{clarificationText}</p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{tertiaryCta.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Rejoignez DogShift dès maintenant pour suivre le lancement et accéder aux prochaines étapes dans votre région.
              </p>
              <Link
                href={tertiaryCta.href}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]"
              >
                <span>{tertiaryCta.label}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Dog-sitting {cityLabel} avec DogShift
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              {introParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{clarificationTitle}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">{clarificationText}</p>
          </div>
        </div>
      </section>

      {valueItems.length > 0 ? (
        <section className="bg-slate-50 pb-14 sm:pb-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{valueTitle}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {valueItems.map((item, index) => {
                  const Icon = index === 0 ? BadgeCheck : index === 1 ? ShieldCheck : Bell;
                  return (
                    <section
                      key={item.title}
                      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8"
                    >
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">{item.description}</p>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.16)] sm:p-8">
            <p className="text-xs font-semibold text-slate-600">{ctaEyebrow}</p>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{ctaTitle}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">{ctaText}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={primaryCta.href}
                className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                {primaryCta.label}
              </Link>
              <Link
                href={secondaryCta.href}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                {secondaryCta.label}
              </Link>
              <Link
                href={tertiaryCta.href}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                {tertiaryCta.label}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
