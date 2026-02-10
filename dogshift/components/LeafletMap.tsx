"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

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

const FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  geneve: { lat: 46.2044, lng: 6.1432 },
  lausanne: { lat: 46.5197, lng: 6.6323 },
  nyon: { lat: 46.3833, lng: 6.2396 },
  "1201": { lat: 46.2046, lng: 6.1432 },
  "1207": { lat: 46.2102, lng: 6.1589 },
  "1003": { lat: 46.5191, lng: 6.6323 },
  "1006": { lat: 46.5334, lng: 6.6645 },
  "1260": { lat: 46.3833, lng: 6.2396 },
};

function resolveCoords(city: string, postalCode: string) {
  const pc = String(postalCode ?? "").trim();
  if (pc && FALLBACK_COORDS[pc]) return FALLBACK_COORDS[pc];
  const c = String(city ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (c && FALLBACK_COORDS[c]) return FALLBACK_COORDS[c];
  return null;
}

type UiSitter = {
  id: string;
  name: string;
  city: string;
  rating: number | null;
  pricePerDay: number;
  services: ServiceType[];
  pricing: Partial<Record<ServiceType, number>>;
  lat: number;
  lng: number;
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

function toUiSitter(row: SitterListItem): UiSitter | null {
  const sitterId = String(row.sitterId ?? "").trim();
  if (!sitterId) return null;
  const rawLat = typeof row.lat === "number" && Number.isFinite(row.lat) ? row.lat : null;
  const rawLng = typeof row.lng === "number" && Number.isFinite(row.lng) ? row.lng : null;
  const fallback = rawLat == null || rawLng == null ? resolveCoords(row.city, row.postalCode) : null;
  const lat = rawLat ?? fallback?.lat ?? null;
  const lng = rawLng ?? fallback?.lng ?? null;
  if (lat == null || lng == null) return null;

  const services = parseServices(row.services);
  const pricing = parsePricing(row.pricing);
  const priceCandidates = Object.values(pricing).filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
  const pricePerDay = priceCandidates.length ? Math.min(...priceCandidates) : 0;

  return {
    id: sitterId,
    name: row.name,
    city: row.city,
    rating: null,
    pricePerDay,
    services,
    pricing,
    lat,
    lng,
  };
}

function formatRatingMaybe(rating: number | null) {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return "—";
  return rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
}

const pinIcon = L.divIcon({
  className: "dogshift-pin",
  html: `
    <div style="
      width: 18px;
      height: 18px;
      border-radius: 9999px;
      background: rgba(79, 70, 229, 0.95);
      box-shadow: 0 10px 22px -12px rgba(2, 6, 23, 0.55);
      border: 2px solid rgba(255, 255, 255, 0.95);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function LeafletMap({
  variant,
}: {
  variant: "preview" | "expanded";
}) {
  const [sittersLoaded, setSittersLoaded] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const [sitters, setSitters] = useState<UiSitter[]>([]);

  useEffect(() => {
    setSittersLoaded(false);
    void (async () => {
      try {
        const res = await fetch("/api/sitters", { method: "GET", cache: "no-store" });
        const payload = (await res.json()) as { ok?: boolean; sitters?: SitterListItem[] };
        if (!res.ok || !payload?.ok || !Array.isArray(payload.sitters)) {
          setPublishedCount(0);
          setSitters([]);
          setSittersLoaded(true);
          return;
        }
        setPublishedCount(payload.sitters.length);
        const next = payload.sitters.map(toUiSitter).filter(Boolean) as UiSitter[];
        setSitters(next);
        setSittersLoaded(true);
      } catch {
        setPublishedCount(0);
        setSitters([]);
        setSittersLoaded(true);
      }
    })();
  }, []);

  const bounds = useMemo(() => {
    if (!sitters.length) return null;
    const lats = sitters.map((s) => s.lat);
    const lngs = sitters.map((s) => s.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
  }, [sitters]);

  const mapProps =
    variant === "preview"
      ? {
          scrollWheelZoom: false,
          zoomControl: false,
          dragging: true,
          doubleClickZoom: false,
          attributionControl: false,
        }
      : {
          scrollWheelZoom: true,
          zoomControl: true,
          dragging: true,
          doubleClickZoom: true,
          attributionControl: true,
        };

  if (sittersLoaded && publishedCount === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Aucun sitter publié</p>
          <p className="mt-2 text-sm text-slate-600">
            La carte affichera automatiquement les sitters dont l’annonce est publiée.
          </p>
        </div>
      </div>
    );
  }

  if (sittersLoaded && publishedCount > 0 && !sitters.length) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Localisation manquante</p>
          <p className="mt-2 text-sm text-slate-600">
            Des annonces sont publiées, mais aucune n’a de coordonnées (ou un lieu reconnu) pour être placée sur la carte.
          </p>
        </div>
      </div>
    );
  }

  if (!sittersLoaded || !bounds) {
    return <div className="h-full w-full bg-slate-50" />;
  }

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [40, 40] }}
      className="h-full w-full"
      {...mapProps}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {sitters.map((sitter) => (
        <Marker
          key={sitter.id}
          position={[sitter.lat, sitter.lng] as [number, number]}
          icon={pinIcon as unknown as L.Icon}
        >
          <Popup>
            <div className="min-w-[220px]">
              <p className="text-sm font-semibold text-slate-900">{sitter.name}</p>
              <p className="mt-1 text-xs text-slate-600">
                {sitter.city} • {formatRatingMaybe(sitter.rating)} ★
              </p>
              <p className="mt-2 text-xs text-slate-600">
                {(() => {
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
                    <>
                      <span className="text-slate-500">À partir de </span>
                      <span className="font-semibold text-slate-900">CHF {cheapestPrice}</span>
                      <span className="text-slate-500">{cheapestUnit}</span>
                    </>
                  );
                })()}
              </p>
              <Link
                href={`/sitter/${sitter.id}?mode=public`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[var(--dogshift-blue)] px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-[var(--dogshift-blue)]/25 transition hover:bg-[var(--dogshift-blue)]/90"
              >
                Voir profil
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
