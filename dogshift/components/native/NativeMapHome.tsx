"use client";
/* eslint-disable @next/next/no-img-element */

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import { Search, Locate, Star, Heart } from "lucide-react";

import { resolveCoordsForPublishedSitterMap } from "@/lib/sitterMapGeo";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Native home screen — map-first UX inspired by HoneyPaws.
 *
 * Rendered ONLY inside the Capacitor shell (the web home keeps its
 * marketing-heavy hero). Layout :
 *  - Map plein écran zoomed on the Lausanne / Geneva arc (densest sitter area)
 *  - Floating glass search bar at the top (sticky, safe-area aware)
 *  - Paw-shaped markers for each published sitter, with tap → mini-popup
 *  - Bottom sheet (swipeable) with the sitter list — collapsed by default
 *  - Geolocation button bottom-right, opt-in browser API call on tap
 *
 * Reuses `/api/sitters` (no new endpoint) and the shared `resolveCoordsForPublishedSitterMap`
 * geo-resolver so the map matches the web search page.
 */

const LAUSANNE: [number, number] = [6.6323, 46.5197];
const DEFAULT_ZOOM = 9.2;

type SitterRow = {
  sitterId: string;
  name: string;
  city: string;
  postalCode: string;
  bio: string;
  avatarUrl: string | null;
  lat: number | null;
  lng: number | null;
  verified?: boolean;
  averageRating?: number | null;
  countReviews?: number | null;
  services: unknown;
  pricing: unknown;
};

type Service = "Promenade" | "Garde" | "Pension";
const ALL_SERVICES: readonly Service[] = ["Promenade", "Garde", "Pension"] as const;

type UiSitter = {
  id: string;
  name: string;
  city: string;
  avatar: string;
  rating: number | null;
  reviews: number;
  minPrice: number;
  services: Service[];
  lat: number;
  lng: number;
  verified: boolean;
};

function parseServices(value: unknown): Service[] {
  if (Array.isArray(value)) {
    const out: Service[] = [];
    for (const v of value) {
      if (v === "Promenade" || v === "Garde" || v === "Pension") out.push(v);
    }
    return out;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return ALL_SERVICES.filter((s) => obj[s] === true);
  }
  return [];
}

function parseMinPrice(pricing: unknown): number {
  if (!pricing || typeof pricing !== "object") return 0;
  const obj = pricing as Record<string, unknown>;
  const nums: number[] = [];
  for (const key of ["Promenade", "Garde", "Pension"]) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) nums.push(v);
  }
  return nums.length ? Math.min(...nums) : 0;
}

function toUi(row: SitterRow): UiSitter | null {
  const id = String(row.sitterId ?? "").trim();
  if (!id) return null;
  const { lat, lng } = resolveCoordsForPublishedSitterMap(id, row.city, row.postalCode, row.lat, row.lng);
  return {
    id,
    name: row.name,
    city: row.city,
    avatar: row.avatarUrl ?? "https://i.pravatar.cc/160?img=7",
    rating: typeof row.averageRating === "number" ? row.averageRating : null,
    reviews: typeof row.countReviews === "number" ? row.countReviews : 0,
    minPrice: parseMinPrice(row.pricing),
    services: parseServices(row.services),
    lat,
    lng,
    verified: row.verified === true,
  };
}

/**
 * Paw marker — purple circular badge with a stylized paw print.
 * Designed for tap targets (44×44 hit area minimum per Apple HIG).
 */
function PawMarker({ active, avatarUrl }: { active: boolean; avatarUrl?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-full border-2 border-white shadow-[0_6px_16px_rgba(2,6,23,0.35)] transition-transform ${
        active ? "scale-110 ring-2 ring-[var(--dogshift-blue)] ring-offset-2" : ""
      }`}
      style={{
        width: 44,
        height: 44,
        background: "linear-gradient(135deg, #2f4d6b 0%, #4a6b8c 100%)",
        backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!avatarUrl && (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <circle cx="6" cy="8" r="2.2" />
          <circle cx="18" cy="8" r="2.2" />
          <circle cx="3.5" cy="14" r="1.8" />
          <circle cx="20.5" cy="14" r="1.8" />
          <ellipse cx="12" cy="17" rx="5" ry="4.2" />
        </svg>
      )}
    </div>
  );
}

export default function NativeMapHome() {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const styleUrl = key
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`
    : "";

  const mapRef = useRef<MapRef | null>(null);
  const [sitters, setSitters] = useState<UiSitter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<Service | null>(null);

  // Fetch published sitters once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sitters", { cache: "no-store" });
        const payload = (await res.json()) as { ok?: boolean; sitters?: SitterRow[] };
        if (cancelled) return;
        const mapped = (payload?.sitters ?? []).map(toUi).filter(Boolean) as UiSitter[];
        setSitters(mapped);
      } catch {
        if (!cancelled) setSitters([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredSitters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sitters.filter((s) => {
      if (serviceFilter && !s.services.includes(serviceFilter)) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q);
    });
  }, [sitters, query, serviceFilter]);

  const activeSitter = useMemo(
    () => sitters.find((s) => s.id === activeId) ?? null,
    [sitters, activeId],
  );

  // Browser geoloc — works inside Capacitor WKWebView with NSLocationWhenInUseUsageDescription
  // set in Info.plist (already in the iOS project). No extra plugin needed for v1.
  const handleLocate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const map = mapRef.current;
        if (!map) return;
        try {
          map.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 12,
            duration: 1200,
          });
        } catch {
          // noop
        }
      },
      () => {
        setGeoLoading(false);
        // Silent fail — user denied. Keep Lausanne fallback.
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-100">
      {/* ── Map plein écran ───────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        {styleUrl ? (
          <Map
            ref={mapRef}
            initialViewState={{
              longitude: LAUSANNE[0],
              latitude: LAUSANNE[1],
              zoom: DEFAULT_ZOOM,
            }}
            mapLib={maplibregl as unknown as never}
            mapStyle={styleUrl}
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
            dragRotate={false}
            pitchWithRotate={false}
            touchPitch={false}
          >
            {filteredSitters.map((s) => (
              <Marker
                key={s.id}
                longitude={s.lng}
                latitude={s.lat}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setActiveId(s.id);
                }}
              >
                <PawMarker active={activeId === s.id} avatarUrl={s.avatar} />
              </Marker>
            ))}
          </Map>
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-200 text-sm text-slate-500">
            Carte indisponible (clé MapTiler manquante)
          </div>
        )}
      </div>

      {/* ── Floating search bar + service filter chips (top) ─────────────── */}
      <div
        className="absolute left-0 right-0 z-20 space-y-2 px-4"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-3 shadow-[0_8px_24px_rgba(2,6,23,0.18)] backdrop-blur">
          <Search className="h-5 w-5 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Lieu, nom du dogsitter…"
            className="flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 outline-none"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
          />
        </div>

        {/* Horizontal-scroll service filter chips. Tap to apply, tap the
            active chip again to clear. Same UX pattern as Airbnb / HoneyPaws. */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {ALL_SERVICES.map((s) => {
            const active = serviceFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setServiceFilter(active ? null : s)}
                aria-pressed={active}
                style={{ touchAction: "manipulation" }}
                className={
                  active
                    ? "flex-shrink-0 rounded-full bg-[var(--dogshift-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(47,77,107,0.35)] active:scale-95"
                    : "flex-shrink-0 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_4px_12px_rgba(2,6,23,0.12)] backdrop-blur active:scale-95"
                }
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Geolocate button (bottom-right above sheet) ──────────────────── */}
      <button
        type="button"
        onClick={handleLocate}
        aria-label="Me localiser"
        className="absolute right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_6px_18px_rgba(2,6,23,0.25)] active:scale-95"
        style={{
          bottom: sheetOpen
            ? "calc(70vh + 16px)"
            : "calc(140px + env(safe-area-inset-bottom, 0px))",
          touchAction: "manipulation",
        }}
      >
        <Locate
          className={`h-5 w-5 ${geoLoading ? "animate-pulse text-[var(--dogshift-blue)]" : "text-slate-700"}`}
        />
      </button>

      {/* ── Active sitter mini-popup (above the sheet, when a marker is tapped) ── */}
      {activeSitter && !sheetOpen && (
        <div
          className="absolute left-4 right-4 z-30"
          style={{
            bottom: "calc(140px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <Link
            href={`/sitters/${activeSitter.id}`}
            className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_12px_30px_rgba(2,6,23,0.25)] active:scale-[0.98]"
            style={{ touchAction: "manipulation" }}
          >
            <img
              src={activeSitter.avatar}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-base font-semibold text-slate-900">
                {activeSitter.name}
                {activeSitter.verified && (
                  <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    ✓
                  </span>
                )}
              </div>
              <div className="truncate text-sm text-slate-500">{activeSitter.city}</div>
              <div className="mt-1 flex items-center gap-3 text-xs">
                {activeSitter.rating !== null && (
                  <span className="flex items-center gap-0.5 text-slate-700">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {activeSitter.rating.toFixed(1)}
                    <span className="text-slate-400">({activeSitter.reviews})</span>
                  </span>
                )}
                {activeSitter.minPrice > 0 && (
                  <span className="text-slate-700">dès {activeSitter.minPrice} CHF</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setActiveId(null); }}
              aria-label="Fermer"
              className="-mr-1 h-8 w-8 flex-shrink-0 rounded-full text-slate-400"
              style={{ touchAction: "manipulation" }}
            >
              ✕
            </button>
          </Link>
        </div>
      )}

      {/* ── Bottom sheet : sitter list ───────────────────────────────────── */}
      <div
        className={`absolute left-0 right-0 z-30 rounded-t-3xl bg-white shadow-[0_-12px_30px_rgba(2,6,23,0.18)] transition-transform duration-300 ease-out`}
        style={{
          bottom: 0,
          height: sheetOpen ? "70vh" : "140px",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: "translateY(0)",
        }}
      >
        {/* Drag handle (tap toggles, drag would need a gesture lib) */}
        <button
          type="button"
          onClick={() => setSheetOpen((v) => !v)}
          className="flex w-full flex-col items-center pt-2 pb-1"
          aria-label={sheetOpen ? "Réduire la liste" : "Voir la liste complète"}
          style={{ touchAction: "manipulation" }}
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300" />
        </button>

        <div className="px-4 pt-1 pb-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              {loading ? "Chargement…" : `${filteredSitters.length} dogsitter${filteredSitters.length > 1 ? "s" : ""}`}
            </h2>
            <Link
              href="/search"
              className="text-sm font-medium text-[var(--dogshift-blue)]"
            >
              Filtres
            </Link>
          </div>
        </div>

        <div
          className={`overflow-y-auto px-4 ${sheetOpen ? "pb-32" : "pb-2"}`}
          style={{ maxHeight: sheetOpen ? "calc(70vh - 80px)" : "60px" }}
        >
          {!loading && filteredSitters.length === 0 && (
            <div className="py-6 text-center text-sm text-slate-500">
              Aucun dogsitter trouvé
            </div>
          )}

          {/* Horizontal cards when collapsed, vertical when expanded */}
          <div className={sheetOpen ? "space-y-3" : "flex gap-3 overflow-x-auto -mx-4 px-4"}>
            {filteredSitters.map((s) => (
              <Link
                key={s.id}
                href={`/sitters/${s.id}`}
                onClick={(e) => {
                  if (!sheetOpen) {
                    e.preventDefault();
                    setActiveId(s.id);
                    try {
                      mapRef.current?.flyTo({ center: [s.lng, s.lat], zoom: 13, duration: 600 });
                    } catch {}
                  }
                }}
                className={
                  sheetOpen
                    ? "flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 active:scale-[0.99]"
                    : "flex-shrink-0 w-[200px] flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2"
                }
                style={{ touchAction: "manipulation" }}
              >
                <img
                  src={s.avatar}
                  alt=""
                  className={sheetOpen ? "h-14 w-14 rounded-full object-cover" : "h-10 w-10 rounded-full object-cover"}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {s.name}
                  </div>
                  <div className="truncate text-xs text-slate-500">{s.city}</div>
                  {s.rating !== null && (
                    <div className="mt-0.5 flex items-center gap-0.5 text-xs text-slate-600">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {s.rating.toFixed(1)}
                    </div>
                  )}
                </div>
                {sheetOpen && (
                  <Heart className="h-5 w-5 text-slate-300" />
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
