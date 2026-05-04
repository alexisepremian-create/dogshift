"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Navigation, MapPin } from "lucide-react";

export type TravelMapProps = {
  sitterLat: number;
  sitterLng: number;
  ownerLat: number;
  ownerLng: number;
  distanceKm: number;
  feeCents: number;
  /** When true, map is non-interactive (confirmation / email preview). */
  compact?: boolean;
};

function formatFee(feeCents: number) {
  return `CHF ${(feeCents / 100).toFixed(2)}`;
}

type MapGl = typeof import("react-map-gl/maplibre");

/** Fetch driving route from OSRM and return GeoJSON coordinates. */
async function fetchDrivingRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    return data.routes?.[0]?.geometry?.coordinates ?? null;
  } catch {
    return null;
  }
}

export function TravelMap({
  sitterLat,
  sitterLng,
  ownerLat,
  ownerLng,
  distanceKm,
  feeCents,
  compact = false,
}: TravelMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
  const [mapGl, setMapGl] = useState<MapGl | null>(null);
  const [mapLibre, setMapLibre] = useState<{ default: unknown } | null>(null);
  const mapRef = useRef<import("react-map-gl/maplibre").MapRef | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);

  // Load map libraries
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [gl, ml] = await Promise.all([
          import("react-map-gl/maplibre"),
          import("maplibre-gl"),
        ]);
        if (cancelled) return;
        setMapGl(gl);
        setMapLibre(ml);
      } catch {
        // map fails gracefully — static fallback
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch driving route from OSRM
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const coords = await fetchDrivingRoute(sitterLng, sitterLat, ownerLng, ownerLat);
      if (!cancelled) setRouteCoords(coords);
    })();
    return () => { cancelled = true; };
  }, [sitterLat, sitterLng, ownerLat, ownerLng]);

  // Update route source when coords arrive after map is already loaded
  useEffect(() => {
    if (!mapLoaded || !routeCoords) return;
    const map = mapRef.current?.getMap() as import("maplibre-gl").Map | undefined;
    if (!map) return;
    const src = map.getSource("travel-route") as import("maplibre-gl").GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: routeCoords },
      properties: {},
    });
  }, [routeCoords, mapLoaded]);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap() as import("maplibre-gl").Map | undefined;
    if (!map) return;

    // Route line — straight line first, replaced with real route when OSRM responds
    const initialCoords: [number, number][] = routeCoords ?? [
      [sitterLng, sitterLat],
      [ownerLng, ownerLat],
    ];

    if (!map.getSource("travel-route")) {
      map.addSource("travel-route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: initialCoords },
          properties: {},
        },
      });
      map.addLayer({
        id: "travel-route-line",
        type: "line",
        source: "travel-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#4F46E5",
          "line-width": 3,
        },
      });
    }

    // Fit both markers with generous padding and capped zoom
    const padH = 70;
    const padV = 55;
    map.fitBounds(
      [
        [Math.min(sitterLng, ownerLng), Math.min(sitterLat, ownerLat)],
        [Math.max(sitterLng, ownerLng), Math.max(sitterLat, ownerLat)],
      ],
      { padding: { top: padV, bottom: padV, left: padH, right: padH }, maxZoom: 14, duration: 0 },
    );
    setMapLoaded(true);
  }, [ownerLat, ownerLng, sitterLat, sitterLng, routeCoords]);

  const centerLng = (sitterLng + ownerLng) / 2;
  const centerLat = (sitterLat + ownerLat) / 2;
  const styleUrl = apiKey ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}` : "";

  const mapHeight = compact ? "h-36" : "h-48";

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50">
      {/* Map */}
      <div className={`relative w-full ${mapHeight}`}>
        {mapGl && mapLibre && styleUrl ? (
          <mapGl.Map
            ref={mapRef}
            mapLib={mapLibre.default as Parameters<typeof mapGl.Map>[0]["mapLib"]}
            mapStyle={styleUrl}
            initialViewState={{ longitude: centerLng, latitude: centerLat, zoom: 11 }}
            interactive={!compact}
            onLoad={onMapLoad}
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
          >
            {/* Sitter marker — small indigo dot */}
            <mapGl.Marker longitude={sitterLng} latitude={sitterLat} anchor="center">
              <div className="h-4 w-4 rounded-full border-2 border-white bg-indigo-600 shadow-md" />
            </mapGl.Marker>
            {/* Owner marker — small emerald dot */}
            <mapGl.Marker longitude={ownerLng} latitude={ownerLat} anchor="center">
              <div className="h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow-md" />
            </mapGl.Marker>
          </mapGl.Map>
        ) : (
          <div className={`flex items-center justify-center bg-slate-100 ${mapHeight}`}>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        )}

        {/* Legend overlay */}
        {mapLoaded && (
          <div className="absolute bottom-2 left-2 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 shadow backdrop-blur-sm">
              <span className="inline-block h-3 w-3 rounded-full bg-indigo-600" />
              Sitter
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 shadow backdrop-blur-sm">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
              Vous
            </div>
          </div>
        )}
      </div>

      {/* Fee info bar */}
      <div className="flex flex-wrap items-center gap-4 border-t border-indigo-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Navigation className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
          <span className="text-slate-700">
            <span className="font-semibold text-slate-900">{distanceKm.toFixed(1)} km</span>
            {" "}de déplacement
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
          <span className="text-slate-700">
            Frais :{" "}
            <span className="font-semibold text-slate-900">{formatFee(feeCents)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
