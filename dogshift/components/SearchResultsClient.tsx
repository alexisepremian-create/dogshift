"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, PawPrint, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function formatRating(rating: number) {
  return rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
}

function ratingValue(rating: number | null) {
  return typeof rating === "number" && Number.isFinite(rating) ? rating : -1;
}

function formatRatingMaybe(rating: number | null) {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return "—";
  return formatRating(rating);
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.366 2.447a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.447a1 1 0 00-1.176 0l-3.366 2.447c-.784.57-1.838-.197-1.54-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.102 9.384c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

type SortKey = "rating_desc" | "verified_first" | "price_asc" | "price_desc" | "distance_asc";

const SERVICE_OPTIONS = ["", "Promenade", "Garde", "Pension"] as const;
const DOG_SIZE_OPTIONS = ["", "Petit", "Moyen", "Grand"] as const;

const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  geneve: { lat: 46.2044, lng: 6.1432 },
  lausanne: { lat: 46.5197, lng: 6.6323 },
  nyon: { lat: 46.3833, lng: 6.2396 },
  "1201": { lat: 46.2046, lng: 6.1432 },
  "1207": { lat: 46.2102, lng: 6.1589 },
  "1003": { lat: 46.5191, lng: 6.6323 },
  "1006": { lat: 46.5334, lng: 6.6645 },
  "1260": { lat: 46.3833, lng: 6.2396 },
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

type ServiceType = "Promenade" | "Garde" | "Pension";

type SitterListItem = {
  sitterId: string;
  name: string;
  city: string;
  postalCode: string;
  bio: string;
  avatarUrl: string | null;
  lat: number | null;
  lng: number | null;
  services: unknown;
  pricing: unknown;
  dogSizes: unknown;
  updatedAt: string;
};

type UiSitter = {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  rating: number | null;
  reviewCount: number;
  pricePerDay: number;
  services: ServiceType[];
  dogSizes: string[];
  pricing: Partial<Record<ServiceType, number>>;
  bio: string;
  responseTime: string;
  verified: boolean;
  lat: number;
  lng: number;
  avatarUrl: string;
};

function parseServices(value: unknown): ServiceType[] {
  if (!Array.isArray(value)) return [];
  const cleaned: ServiceType[] = [];
  for (const v of value) {
    if (v === "Promenade" || v === "Garde" || v === "Pension") cleaned.push(v);
  }
  return cleaned;
}

function parsePricing(value: unknown): Partial<Record<ServiceType, number>> {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  const out: Partial<Record<ServiceType, number>> = {};
  for (const key of ["Promenade", "Garde", "Pension"] as const) {
    const n = obj[key];
    if (typeof n === "number" && Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

function parseDogSizes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function toUiSitter(row: SitterListItem): UiSitter | null {
  const sitterId = String(row.sitterId ?? "").trim();
  if (!sitterId) return null;
  const services = parseServices(row.services);
  const pricing = parsePricing(row.pricing);
  const dogSizes = parseDogSizes(row.dogSizes);

  const priceCandidates = Object.values(pricing).filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
  const pricePerDay = priceCandidates.length ? Math.min(...priceCandidates) : 0;

  return {
    id: sitterId,
    name: row.name,
    city: row.city,
    postalCode: row.postalCode,
    rating: null,
    reviewCount: 0,
    pricePerDay,
    services,
    dogSizes,
    pricing,
    bio: row.bio,
    responseTime: "~1h",
    verified: false,
    lat: typeof row.lat === "number" && Number.isFinite(row.lat) ? row.lat : 0,
    lng: typeof row.lng === "number" && Number.isFinite(row.lng) ? row.lng : 0,
    avatarUrl: row.avatarUrl ?? "https://i.pravatar.cc/160?img=7",
  };
}

export default function SearchResultsClient() {
  const sp = useSearchParams();

  const [flash, setFlash] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sitters, setSitters] = useState<UiSitter[]>([]);
  const [sittersLoaded, setSittersLoaded] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem("dogshift_flash");
      if (!msg) return;
      sessionStorage.removeItem("dogshift_flash");
      setFlash(msg);
      window.setTimeout(() => setFlash(null), 4500);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSittersLoaded(false);
    void (async () => {
      try {
        const res = await fetch("/api/sitters", { method: "GET", cache: "no-store" });
        const payload = (await res.json()) as { ok?: boolean; sitters?: SitterListItem[] };
        if (!res.ok || !payload?.ok || !Array.isArray(payload.sitters)) {
          setSitters([]);
          setSittersLoaded(true);
          return;
        }

        const next = payload.sitters.map(toUiSitter).filter(Boolean) as UiSitter[];
        setSitters(next);
        setSittersLoaded(true);
      } catch {
        setSitters([]);
        setSittersLoaded(true);
      }
    })();
  }, [hydrated]);

  const initialService = (sp.get("service") ?? "").trim();
  const initialLocation = (sp.get("location") ?? "").trim();

  const [service, setService] = useState<(typeof SERVICE_OPTIONS)[number]>(
    (SERVICE_OPTIONS as readonly string[]).includes(initialService) ? (initialService as (typeof SERVICE_OPTIONS)[number]) : ""
  );
  const [location, setLocation] = useState(initialLocation);
  const [dogSize, setDogSize] = useState<(typeof DOG_SIZE_OPTIONS)[number]>("");
  const [sort, setSort] = useState<SortKey>("rating_desc");

  const isResultsMode = Boolean(service || location || dogSize || sort !== "rating_desc");

  const filtered = useMemo(() => {
    const normalizedLocation = normalize(location);
    const coords = normalizedLocation ? LOCATION_COORDS[normalizedLocation] ?? LOCATION_COORDS[location.trim()] : undefined;

    const getEffectivePrice = (sitter: UiSitter) => {
      const pricing = sitter.pricing as Record<string, number | undefined>;
      if (service && typeof pricing?.[service] === "number") return pricing[service] as number;
      const values = Object.values(pricing ?? {}).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (values.length > 0) return Math.min(...values);
      return sitter.pricePerDay;
    };

    const rows = sitters
      .map((sitter) => {
        const distanceKm = coords ? haversineKm(coords, { lat: sitter.lat, lng: sitter.lng }) : null;
        return { sitter, distanceKm };
      })
      .filter(({ sitter, distanceKm }) => {
      const matchesService = service ? sitter.services.some((s) => normalize(s) === normalize(service)) : true;
      const matchesLocation = normalizedLocation
        ? normalize(sitter.city).startsWith(normalizedLocation) || normalize(sitter.postalCode).startsWith(normalizedLocation)
        : true;
      const matchesDogSize = dogSize ? sitter.dogSizes.some((s) => normalize(s) === normalize(dogSize)) : true;
      const matchesVerified = sort === "verified_first" ? Boolean(sitter.verified) : true;
      const matchesDistance = sort === "distance_asc" && coords ? distanceKm !== null : true;
      return matchesService && matchesLocation && matchesDogSize && matchesVerified && matchesDistance;
    });

    rows.sort((a, b) => {
      if (sort === "verified_first") {
        const av = a.sitter.verified ? 1 : 0;
        const bv = b.sitter.verified ? 1 : 0;
        if (av !== bv) return bv - av;
        return ratingValue(b.sitter.rating) - ratingValue(a.sitter.rating);
      }
      if (sort === "rating_desc") return ratingValue(b.sitter.rating) - ratingValue(a.sitter.rating);
      if (sort === "price_asc") return getEffectivePrice(a.sitter) - getEffectivePrice(b.sitter);
      if (sort === "price_desc") return getEffectivePrice(b.sitter) - getEffectivePrice(a.sitter);
      if (sort === "distance_asc") {
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      }
      return 0;
    });

    return rows;
  }, [service, location, dogSize, sort, sitters]);

  const resultsSubtitle = useMemo(() => {
    if (!isResultsMode) return "";

    if (location) {
      return `Dog-sitters à ${location}`;
    }

    return `${filtered.length} dog-sitters trouvés`;
  }, [filtered.length, isResultsMode, location]);

  const showEmpty = filtered.length === 0;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        {flash ? (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-[0_12px_40px_-32px_rgba(2,6,23,0.18)]">
            {flash}
          </div>
        ) : null}

        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {isResultsMode ? <Search className="h-6 w-6 text-slate-700" aria-hidden="true" /> : null}
              <span>{isResultsMode ? "Résultats de recherche" : "Trouvez un dog-sitter de confiance"}</span>
              {!isResultsMode ? <PawPrint className="h-6 w-6 text-slate-700" aria-hidden="true" /> : null}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {isResultsMode ? (
                <>
                  <span className="font-medium text-slate-900">{resultsSubtitle}</span>
                  {service ? (
                    <>
                      <span className="mx-2 text-slate-300">/</span>
                      <span className="font-medium text-slate-900">{service}</span>
                    </>
                  ) : null}
                </>
              ) : (
                <span>Explorez les dogsitters disponibles et affinez votre recherche.</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_-30px_rgba(2,6,23,0.22)] sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700" htmlFor="filter-location">
                Ville / code postal
              </label>
              <input
                id="filter-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex. Genève ou 1201"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                autoComplete="off"
                inputMode="text"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700" htmlFor="filter-service">
                Service
              </label>
              <select
                id="filter-service"
                value={service}
                onChange={(e) => setService(e.target.value as (typeof SERVICE_OPTIONS)[number])}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
              >
                <option value="">Tous</option>
                <option value="Promenade">Promenade</option>
                <option value="Garde">Garde</option>
                <option value="Pension">Pension</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700" htmlFor="filter-dogsize">
                Taille du chien
              </label>
              <select
                id="filter-dogsize"
                value={dogSize}
                onChange={(e) => setDogSize(e.target.value as (typeof DOG_SIZE_OPTIONS)[number])}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
              >
                <option value="">Toutes</option>
                <option value="Petit">Petit</option>
                <option value="Moyen">Moyen</option>
                <option value="Grand">Grand</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700" htmlFor="filter-start">
                Du
              </label>
              <input
                id="filter-start"
                type="date"
                disabled
                className="mt-2 w-full cursor-not-allowed rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-400 opacity-60 shadow-sm outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700" htmlFor="filter-end">
                Au
              </label>
              <input
                id="filter-end"
                type="date"
                disabled
                className="mt-2 w-full cursor-not-allowed rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-400 opacity-60 shadow-sm outline-none"
              />
              <p className="mt-2 text-xs text-slate-400">Filtre par dates disponible prochainement</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{filtered.length}</span>
              <span className="text-slate-500"> sitters</span>
            </p>

            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-700" htmlFor="filter-sort">
                Trier
              </label>
              <select
                id="filter-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none transition hover:bg-slate-50 focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
              >
                <option value="rating_desc">Note</option>
                <option value="verified_first">Profil vérifié</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
                <option value="distance_asc">Distance</option>
              </select>
            </div>
          </div>
        </div>

        {!showEmpty ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(({ sitter }) => (
              (() => {
                const candidates = sitter.services
                  .map((svc) => ({ svc, price: (sitter.pricing as any)?.[svc] }))
                  .filter((row) => typeof row.price === "number" && Number.isFinite(row.price) && row.price > 0) as Array<{
                  svc: (typeof sitter.services)[number];
                  price: number;
                }>;

                candidates.sort((a, b) => a.price - b.price);
                const cheapest = candidates.length ? candidates[0] : null;
                const cheapestUnit = cheapest?.svc === "Pension" ? " / jour" : " / heure";
                const cheapestPrice = cheapest?.price ?? sitter.pricePerDay;

                return (
              <article
                key={sitter.id}
                className="group relative flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_-28px_rgba(2,6,23,0.3)] transition will-change-transform hover:-translate-y-0.5 hover:shadow-[0_18px_60px_-40px_rgba(2,6,23,0.45)]"
              >
                {sitter.verified ? (
                  <div className="absolute right-5 top-5 z-10 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Vérifié
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <img
                      src={sitter.avatarUrl}
                      alt={sitter.name}
                      className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        <Link href={`/sitter/${sitter.id}`} className="hover:underline">
                          {sitter.name}
                        </Link>
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">{sitter.city}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex min-h-[30px] flex-nowrap items-center gap-2 overflow-hidden">
                  <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                    Annulation flexible
                  </span>
                  {sitter.services.map((svc) => (
                    <span
                      key={svc}
                      className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {svc}
                    </span>
                  ))}
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p className="flex items-center gap-1 leading-none">
                    <span className="inline-flex items-center gap-1 font-medium leading-none text-slate-900">
                      <StarIcon className="h-4 w-4 text-[#F5B301]" />
                      {formatRatingMaybe(sitter.rating)}
                    </span>
                    <span className="text-slate-500 leading-none">({sitter.reviewCount} avis)</span>
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Répond {sitter.responseTime}</span>
                  </p>
                  <p className="min-h-[60px] text-slate-600 line-clamp-3">{sitter.bio}</p>
                </div>

                <div className="mt-auto flex items-center justify-between pt-5">
                  <p className="text-sm text-slate-600">
                    <span className="text-slate-500">À partir de </span>
                    <span className="text-base font-semibold text-slate-900">CHF {cheapestPrice}</span>
                    <span className="text-slate-500">{cheapestUnit}</span>
                  </p>
                  <Link
                    href={`/sitter/${sitter.id}?mode=public`}
                    className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                    aria-label={`Contacter ${sitter.name}`}
                  >
                    Contacter
                  </Link>
                </div>
              </article>
                );
              })()
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-700">
            {!sittersLoaded ? (
              <p className="text-sm font-medium">Chargement des annonces…</p>
            ) : service && location ? (
              <p className="text-sm font-medium">
                Aucun dog sitter disponible à <span className="font-semibold">{location}</span> pour le service{" "}
                <span className="font-semibold">{service}</span>
              </p>
            ) : (
              <p className="text-sm font-medium">
                Aucun dog sitter ne correspond à votre recherche. Essayez un autre lieu ou service.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
