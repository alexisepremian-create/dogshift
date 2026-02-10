"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { type MapRef, type MarkerEvent, Marker, Popup } from "react-map-gl/maplibre";

import LeafletMap from "@/components/LeafletMap";

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

  const lat = typeof row.lat === "number" && Number.isFinite(row.lat) ? row.lat : null;
  const lng = typeof row.lng === "number" && Number.isFinite(row.lng) ? row.lng : null;
  if (lat == null || lng == null) return null;

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
    lat,
    lng,
    avatarUrl: row.avatarUrl ?? "https://i.pravatar.cc/160?img=7",
  };
}

function formatRating(rating: number) {
  return rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
}

function formatRatingMaybe(rating: number | null) {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return "—";
  return formatRating(rating);
}

function Pin({ active }: { active: boolean }) {
  return (
    <div className="relative">
      <div
        className={
          active
            ? "absolute left-1/2 top-[14px] h-4 w-4 -translate-x-1/2 rounded-full bg-[var(--dogshift-blue)] opacity-40 blur-[2px]"
            : "absolute left-1/2 top-[14px] h-4 w-4 -translate-x-1/2 rounded-full bg-[var(--dogshift-blue)] opacity-28 blur-[2px]"
        }
        aria-hidden="true"
      />
      <svg
        width="22"
        height="28"
        viewBox="0 0 22 28"
        fill="none"
        aria-hidden="true"
        className={active ? "drop-shadow-[0_14px_18px_rgba(2,6,23,0.28)]" : "drop-shadow-[0_12px_16px_rgba(2,6,23,0.22)]"}
      >
        <path
          d="M11 27s8-7.2 8-15.1C19 6.9 15.4 3 11 3S3 6.9 3 11.9C3 19.8 11 27 11 27Z"
          fill="var(--dogshift-blue)"
        />
        <path
          d="M11 16.2a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6Z"
          fill="rgba(255,255,255,0.92)"
        />
        <path
          d="M11 3c4.4 0 8 3.9 8 8.9C19 19.8 11 27 11 27S3 19.8 3 11.9C3 6.9 6.6 3 11 3Z"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

function applyPremiumStyle(map: MapLibreMap) {
  try {
    const maybeFog = map as unknown as { setFog?: (opts: unknown) => void };
    if (typeof maybeFog.setFog === "function") {
      maybeFog.setFog({
        color: "#1b1f27",
        "high-color": "#253046",
        "space-color": "#14171c",
        "horizon-blend": 0.08,
        range: [0.9, 8],
      });
    }

    const style = map.getStyle();
    const layers = style?.layers ?? [];

    for (const layer of layers) {
      const id = layer.id;

      if (layer.type === "background") {
        map.setPaintProperty(id, "background-color", "#1b1f27");
      }

      if (layer.type === "fill" && id.includes("water")) {
        map.setPaintProperty(id, "fill-color", "#20324a");
        map.setPaintProperty(id, "fill-opacity", 0.94);
      }

      if (layer.type === "line" && (id.includes("water") || id.includes("waterway"))) {
        map.setPaintProperty(id, "line-color", "#2f4d6b");
        map.setPaintProperty(id, "line-opacity", 0.78);
      }

      if (layer.type === "fill" && (id.includes("park") || id.includes("landuse") || id.includes("landcover"))) {
        map.setPaintProperty(id, "fill-color", "#1b2a22");
        map.setPaintProperty(id, "fill-opacity", 0.58);
      }

      if (layer.type === "line" && (id.includes("boundary") || id.includes("admin") || id.includes("disputed"))) {
        map.setPaintProperty(id, "line-color", "#3a4150");
        map.setPaintProperty(id, "line-opacity", 0.5);
      }

      if (layer.type === "line" && id.includes("road")) {
        if (id.includes("motorway") || id.includes("trunk") || id.includes("primary")) {
          map.setPaintProperty(id, "line-color", "#c3d3ea");
          map.setPaintProperty(id, "line-opacity", 0.86);
        } else {
          map.setPaintProperty(id, "line-color", "#3d4858");
          map.setPaintProperty(id, "line-opacity", 0.78);
        }
      }

      if (layer.type === "line" && id.includes("tunnel")) {
        map.setPaintProperty(id, "line-opacity", 0.5);
      }

      if (layer.type === "fill" && id.includes("building")) {
        map.setPaintProperty(id, "fill-opacity", 0.16);
      }

      if (layer.type === "symbol" && id.includes("label")) {
        map.setPaintProperty(id, "text-color", "rgba(226,232,240,0.88)");
        map.setPaintProperty(id, "text-halo-color", "rgba(20,23,28,0.82)");
        map.setPaintProperty(id, "text-halo-width", 0.6);

        if (id.includes("poi") || id.includes("road")) {
          map.setPaintProperty(id, "text-opacity", 0.35);
        } else {
          map.setPaintProperty(id, "text-opacity", 0.6);
        }
      }
    }
  } catch {
    // noop
  }
}

export default function MapboxMap({
  variant,
  theme = "dark",
  serviceFilter = "",
  locationFilter = "",
}: {
  variant: "preview" | "expanded";
  theme?: "light" | "dark";
  serviceFilter?: string;
  locationFilter?: string;
}) {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const styleUrl = key ? `https://api.maptiler.com/maps/base-v4/style.json?key=${key}` : "";
  const mapRef = useRef<MapRef | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [sittersLoaded, setSittersLoaded] = useState(false);
  const [allSitters, setAllSitters] = useState<UiSitter[]>([]);

  useEffect(() => {
    setHasError(false);
  }, [key, styleUrl]);

  useEffect(() => {
    setSittersLoaded(false);
    void (async () => {
      try {
        const res = await fetch("/api/sitters", { method: "GET", cache: "no-store" });
        const payload = (await res.json()) as { ok?: boolean; sitters?: SitterListItem[] };
        if (!res.ok || !payload?.ok || !Array.isArray(payload.sitters)) {
          setAllSitters([]);
          setSittersLoaded(true);
          return;
        }

        const next = payload.sitters.map(toUiSitter).filter(Boolean) as UiSitter[];
        setAllSitters(next);
        setSittersLoaded(true);
      } catch {
        setAllSitters([]);
        setSittersLoaded(true);
      }
    })();
  }, []);

  function zoomBy(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    try {
      const currentZoom = map.getZoom();
      map.easeTo({ zoom: currentZoom + delta, duration: 180 });
    } catch {
      // noop
    }
  }

  const [activeId, setActiveId] = useState<string | null>(null);
  const service = serviceFilter.trim();
  const location = locationFilter.trim();
  const sitters = useMemo(() => {
    const serviceLower = service.toLowerCase();
    const locationLower = location.toLowerCase();

    const filtered = allSitters.filter((sitter) => {
      const matchesService = service
        ? sitter.services.some((s) => s.toLowerCase() === serviceLower)
        : true;
      const matchesLocation = location
        ? sitter.city.toLowerCase().includes(locationLower)
        : true;
      return matchesService && matchesLocation;
    });

    return filtered;
  }, [allSitters, service, location]);

  const effectiveActiveId = activeId && sitters.some((s) => s.id === activeId) ? activeId : null;
  const active = effectiveActiveId ? sitters.find((s) => s.id === effectiveActiveId) : undefined;

  const bounds = useMemo(() => {
    if (!sitters.length) return null;
    const lats = sitters.map((s) => s.lat);
    const lngs = sitters.map((s) => s.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
      minLng,
      minLat,
      maxLng,
      maxLat,
    };
  }, [sitters]);

  const initialViewState = useMemo(
    () =>
      bounds
        ? {
            latitude: (bounds.minLat + bounds.maxLat) / 2,
            longitude: (bounds.minLng + bounds.maxLng) / 2,
            zoom: variant === "preview" ? 9 : 10,
          }
        : { latitude: 46.8182, longitude: 8.2275, zoom: variant === "preview" ? 7 : 7.5 },
    [bounds, variant]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!bounds) return;

    try {
      map.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        {
          padding: variant === "preview" ? 50 : 80,
          duration: 0,
        }
      );
    } catch {
      // noop
    }
  }, [bounds, variant, key, styleUrl]);

  if (!key) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Map indisponible</p>
          <p className="mt-2 text-sm text-slate-600">
            Ajoute <span className="font-mono text-xs">NEXT_PUBLIC_MAPTILER_KEY</span> pour activer la carte.
          </p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return <LeafletMap variant={variant} />;
  }

  if (sittersLoaded && !allSitters.length) {
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

  return (
    <Map
      ref={mapRef}
      initialViewState={initialViewState}
      mapStyle={styleUrl}
      mapLib={maplibregl}
      onError={() => {
        setHasError(true);
      }}
      onLoad={() => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        setMapLoaded(false);
        if (theme === "dark") applyPremiumStyle(map);

        if (typeof map.loaded === "function" && map.loaded()) {
          setMapLoaded(true);
          return;
        }

        map.once("idle", () => {
          setMapLoaded(true);
        });
      }}
      style={{
        width: "100%",
        height: "100%",
        filter:
          theme === "light"
            ? "contrast(1.02) saturate(1.02) brightness(1.02)"
            : "contrast(1.06) saturate(0.96) brightness(1.04)",
      }}
      attributionControl={variant !== "preview" ? { compact: true } : false}
      cooperativeGestures={variant === "preview"}
      scrollZoom={variant !== "preview"}
      dragRotate={false}
      pitchWithRotate={false}
      touchPitch={false}
      onClick={() => setActiveId(null)}
    >
      {variant === "expanded" ? (
        <div className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => zoomBy(1)}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-white/85 text-slate-800 shadow-[0_10px_30px_-18px_rgba(2,6,23,0.35)] ring-1 ring-white/60 backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            aria-label="Zoom avant"
          >
            <span className="text-lg font-semibold leading-none">+</span>
          </button>
          <button
            type="button"
            onClick={() => zoomBy(-1)}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-white/85 text-slate-800 shadow-[0_10px_30px_-18px_rgba(2,6,23,0.35)] ring-1 ring-white/60 backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            aria-label="Zoom arrière"
          >
            <span className="text-lg font-semibold leading-none">−</span>
          </button>
        </div>
      ) : null}

      {mapLoaded && sittersLoaded ? (
        <>
          {sitters.map((sitter) => {
            const isActive = sitter.id === effectiveActiveId;
            return (
              <Marker
                key={sitter.id}
                latitude={sitter.lat}
                longitude={sitter.lng}
                anchor="center"
                onClick={(e: MarkerEvent<MouseEvent>) => {
                  e.originalEvent.stopPropagation();
                  setActiveId(sitter.id);
                }}
              >
                <Pin active={isActive} />
              </Marker>
            );
          })}

          {active ? (
            <Popup
              latitude={active.lat}
              longitude={active.lng}
              anchor="bottom"
              maxWidth="260px"
              className="dogshift-popup"
              closeButton={false}
              closeOnClick={false}
              offset={18}
              onClose={() => setActiveId(null)}
            >
              <div className="w-[220px] max-w-[220px] overflow-hidden">
                <p className="text-sm font-semibold tracking-tight text-slate-900">{active.name}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {active.city} <span className="text-slate-300">•</span> {formatRatingMaybe(active.rating)} ★
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  {(() => {
                    const candidates = active.services
                      .map((svc) => ({ svc, price: (active.pricing as any)?.[svc] }))
                      .filter((row) => typeof row.price === "number" && Number.isFinite(row.price) && row.price > 0) as Array<{
                      svc: (typeof active.services)[number];
                      price: number;
                    }>;
                    candidates.sort((a, b) => a.price - b.price);
                    const cheapest = candidates.length ? candidates[0] : null;
                    const cheapestUnit = cheapest?.svc === "Pension" ? " / jour" : " / heure";
                    const cheapestPrice = cheapest?.price ?? active.pricePerDay;

                    return (
                      <>
                        <span className="text-slate-500">À partir de </span>
                        <span className="font-semibold text-slate-900">CHF {cheapestPrice}</span>
                        <span className="text-slate-500">{cheapestUnit}</span>
                      </>
                    );
                  })()}
                </p>

                <div className="mt-3">
                  <Link
                    href={`/sitter/${active.id}?mode=public`}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--dogshift-blue)] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_70%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                  >
                    Voir profil
                    <span className="text-white/70">→</span>
                  </Link>
                </div>
              </div>
            </Popup>
          ) : null}
        </>
      ) : null}
    </Map>
  );
}
