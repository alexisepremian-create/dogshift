import Link from "next/link";
import type { Metadata } from "next";

import HomePageClient from "./HomePageClient";
import type { SitterPreview } from "@/components/ui/SitterCard";
import { prisma } from "@/lib/prisma";
import { resolvePublicEnabledServices, normalizePersistedPublicPricing } from "@/lib/sitterEnabledServices";

export const revalidate = 300;

const homepageTitle = "DogShift – Dog-sitting premium en Suisse";
const homepageDescription =
  "DogShift est une plateforme de dog-sitting premium en Suisse. Trouvez un dog-sitter de confiance pour promenade, garde ou pension.";
const homepageUrl = "https://www.dogshift.ch";

export const metadata: Metadata = {
  title: homepageTitle,
  description: homepageDescription,
  alternates: { canonical: homepageUrl },
  openGraph: {
    type: "website",
    url: homepageUrl,
    title: homepageTitle,
    description: homepageDescription,
    siteName: "DogShift",
    locale: "fr_CH",
  },
  twitter: {
    card: "summary_large_image",
    title: homepageTitle,
    description: homepageDescription,
  },
};

async function getFeaturedSitters(): Promise<SitterPreview[]> {
  try {
    const rows = await (prisma as any).sitterProfile.findMany({
      where: { published: true },
      orderBy: { updatedAt: "desc" },
      take: 24,
      select: {
        sitterId: true,
        displayName: true,
        city: true,
        avatarUrl: true,
        verificationStatus: true,
        services: true,
        pricing: true,
        user: { select: { name: true, image: true } },
      },
    });

    const sitterIds: string[] = rows
      .map((r: any) => String(r.sitterId ?? "").trim())
      .filter(Boolean);

    const [configRows, reviewAggs] = await Promise.all([
      sitterIds.length > 0
        ? (prisma as any).serviceConfig.findMany({
            where: { sitterId: { in: sitterIds } },
            select: { sitterId: true, serviceType: true, enabled: true },
          })
        : Promise.resolve([]),
      sitterIds.length > 0
        ? (prisma as any).review.groupBy({
            by: ["sitterId"],
            where: { sitterId: { in: sitterIds } },
            _count: { id: true },
            _avg: { rating: true },
          })
        : Promise.resolve([]),
    ]);

    const configsBySitter = new Map<string, any[]>();
    for (const row of configRows) {
      const sid = String(row?.sitterId ?? "");
      if (!sid) continue;
      const list = configsBySitter.get(sid) ?? [];
      list.push(row);
      configsBySitter.set(sid, list);
    }

    const reviewMap = new Map<string, { avg: number | null; count: number }>();
    for (const agg of reviewAggs) {
      const sid = String(agg?.sitterId ?? "");
      if (!sid) continue;
      reviewMap.set(sid, {
        avg:
          typeof agg._avg?.rating === "number" && Number.isFinite(agg._avg.rating)
            ? agg._avg.rating
            : null,
        count: typeof agg._count?.id === "number" ? agg._count.id : 0,
      });
    }

    return rows
      .map((s: any): SitterPreview | null => {
        const sid = String(s.sitterId ?? "").trim();
        if (!sid) return null;

        const services = resolvePublicEnabledServices({
          serviceConfigs: configsBySitter.get(sid) ?? [],
          pricing: s.pricing,
          servicesJson: s.services,
        });

        const pricing = normalizePersistedPublicPricing(s.pricing);
        const prices = (Object.values(pricing) as number[]).filter(
          (v) => typeof v === "number" && Number.isFinite(v),
        );
        const minPrice = prices.length > 0 ? Math.min(...prices) : null;

        const rev = reviewMap.get(sid);

        return {
          sitterId: sid,
          displayName: String(s.displayName ?? s.user?.name ?? "").trim() || "Dogsitter",
          city: String(s.city ?? "").trim(),
          avatarUrl: (s.avatarUrl ?? s.user?.image ?? null) as string | null,
          verified: s.verificationStatus === "approved",
          services,
          minPrice,
          averageRating: rev?.avg ?? null,
          countReviews: rev?.count ?? 0,
        };
      })
      .filter((r: SitterPreview | null): r is SitterPreview => r !== null);
  } catch (err) {
    console.error("[homepage] getFeaturedSitters error:", err);
    return [];
  }
}

export default async function Home() {
  const sitters = await getFeaturedSitters();

  return (
    <>
      <HomePageClient sitters={sitters} />
      <section className="bg-slate-50 pb-16 pt-14 sm:pb-20 sm:pt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Dog-sitting en Suisse avec DogShift
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              <p>
                DogShift est une plateforme de dog-sitting en Suisse qui permet de trouver facilement
                un dog sitter de confiance.
              </p>
              <p>
                Que vous recherchiez une promenade de chien, une garde à domicile ou une pension pour
                votre chien, DogShift met en relation les propriétaires avec des dogsitters vérifiés.
              </p>
              <p>
                Disponible à Lausanne, Genève et dans toute la Suisse, DogShift vous permet de trouver
                rapidement un service de garde pour chien adapté à vos besoins, notamment pour trouver
                un dog sitter à Lausanne et dans votre région.
              </p>
              <p>
                Nos dogsitters proposent différents services : promenade quotidienne, garde à domicile,
                pension longue durée et visites à domicile.
              </p>
              <p>
                Grâce à un processus de sélection rigoureux et des profils vérifiés, DogShift garantit
                une expérience fiable, sécurisée et transparente.
              </p>
              <p>
                Vous recherchez un{" "}
                <Link
                  href="/dog-sitter-lausanne"
                  className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                >
                  dog sitter à Lausanne
                </Link>{" "}
                ou un{" "}
                <Link
                  href="/dog-sitter-geneve"
                  className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                >
                  dog sitter à Genève
                </Link>{" "}
                ? Découvrez nos services disponibles dans votre région.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
