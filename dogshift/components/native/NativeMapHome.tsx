"use client";
/* eslint-disable @next/next/no-img-element */

import maplibregl from "maplibre-gl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import { useRouter } from "next/navigation";
import { Search, Locate, Star, X, Minus, Plus, MapPin, Calendar, ArrowLeft, SlidersHorizontal } from "lucide-react";

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
  // `query` is kept (used by filteredSitters) but no longer set from the UI —
  // the inline search input was replaced by a modal trigger; full search lives
  // in the StickySearchBar modal which redirects to /sitters with params.
  const [query] = useState("");
  const [serviceFilter, setServiceFilter] = useState<Service | null>(null);

  // ── Filter popup state ────────────────────────────────────────────────
  // Opened by tapping "Filtres" in the sitter sheet. Refines the map +
  // sheet results in-place (no /search redirect — founder feedback).
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterMinRating, setFilterMinRating] = useState(0);  // 0 = no filter, else 4 / 4.5 / 4.8
  const PRICE_MIN = 0;
  const PRICE_MAX = 150;
  const [filterPriceMin, setFilterPriceMin] = useState(PRICE_MIN);
  const [filterPriceMax, setFilterPriceMax] = useState(PRICE_MAX);
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [filterWithReviewsOnly, setFilterWithReviewsOnly] = useState(false);
  const [filterSort, setFilterSort] = useState<"default" | "rating" | "reviews" | "price">("default");

  const priceFiltered = filterPriceMin > PRICE_MIN || filterPriceMax < PRICE_MAX;
  const activeFilterCount =
    (filterMinRating > 0 ? 1 : 0) +
    (priceFiltered ? 1 : 0) +
    (filterVerifiedOnly ? 1 : 0) +
    (filterWithReviewsOnly ? 1 : 0) +
    (filterSort !== "default" ? 1 : 0);

  const resetFilters = useCallback(() => {
    setFilterMinRating(0);
    setFilterPriceMin(PRICE_MIN);
    setFilterPriceMax(PRICE_MAX);
    setFilterVerifiedOnly(false);
    setFilterWithReviewsOnly(false);
    setFilterSort("default");
  }, []);

  // ── Search panel state ──────────────────────────────────────────────────
  // Top-anchored panel that slides DOWN under the search bar and extends to
  // just above the bottom nav. Founder feedback : "le pop up de recherche
  // entier s'affiche de haut en bas juste sous la search barre c'est plus
  // intuitif" (and the bottom-sheet had the purple submit button hidden
  // behind the nav).
  const router = useRouter();
  const lieuInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // "main" = search form ; "filters" = filter form (same panel, slides in
  // like a second page). Founder request : "rajoute une option filtre aussi
  // la dans le pop up de recherche … genre que ca fasse comme une deuxieme
  // page".
  const [searchPanelView, setSearchPanelView] = useState<"main" | "filters">("main");
  const [searchService, setSearchService] = useState<Service>("Promenade");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchDate, setSearchDate] = useState<string | null>(null);          // single date (Promenade/Garde)
  const [searchDateStart, setSearchDateStart] = useState<string | null>(null); // pension range start
  const [searchDateEnd, setSearchDateEnd] = useState<string | null>(null);     // pension range end
  const [dogPetit, setDogPetit] = useState(0);
  const [dogMoyen, setDogMoyen] = useState(1);
  const [dogGrand, setDogGrand] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Month being shown in the inline calendar.
  const todayDateRef = useRef(new Date());
  const [calMonth, setCalMonth] = useState(() => {
    const d = todayDateRef.current;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const isPension = searchService === "Pension";

  const handleSearchSubmit = useCallback(() => {
    const params = new URLSearchParams();
    if (searchLocation.trim()) params.set("q", searchLocation.trim());
    if (isPension) {
      if (searchDateStart) params.set("from", searchDateStart);
      if (searchDateEnd) params.set("to", searchDateEnd);
    } else if (searchDate) {
      params.set("date", searchDate);
    }
    params.set("service", searchService);
    const totalDogs = dogPetit + dogMoyen + dogGrand;
    if (totalDogs > 0) {
      params.set("dogs", String(totalDogs));
      if (dogPetit) params.set("petit", String(dogPetit));
      if (dogMoyen) params.set("moyen", String(dogMoyen));
      if (dogGrand) params.set("grand", String(dogGrand));
    }
    setSearchOpen(false);
    router.push(`/sitters?${params.toString()}`);
  }, [router, isPension, searchService, searchLocation, searchDate, searchDateStart, searchDateEnd, dogPetit, dogMoyen, dogGrand]);

  // Format a Date or "YYYY-MM-DD" string in fr-CH.
  const formatDateFR = useCallback((iso: string | null) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    return dt.toLocaleDateString("fr-CH", { day: "numeric", month: "long" });
  }, []);

  // Tap a day in the calendar — single-pick for Promenade/Garde, range-pick
  // for Pension (first tap = start, second tap = end).
  const handleDayTap = useCallback((iso: string) => {
    if (isPension) {
      if (!searchDateStart || (searchDateStart && searchDateEnd)) {
        setSearchDateStart(iso);
        setSearchDateEnd(null);
      } else if (iso < searchDateStart) {
        setSearchDateStart(iso);
      } else {
        setSearchDateEnd(iso);
      }
    } else {
      setSearchDate(iso);
      setCalendarOpen(false);
    }
  }, [isPension, searchDateStart, searchDateEnd]);

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
    const list = sitters.filter((s) => {
      if (serviceFilter && !s.services.includes(serviceFilter)) return false;
      if (filterMinRating > 0 && (s.rating ?? 0) < filterMinRating) return false;
      if (s.minPrice < filterPriceMin || s.minPrice > filterPriceMax) return false;
      if (filterVerifiedOnly && !s.verified) return false;
      if (filterWithReviewsOnly && s.reviews === 0) return false;
      if (q && !(s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q))) return false;
      return true;
    });
    if (filterSort === "rating") return list.slice().sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (filterSort === "reviews") return list.slice().sort((a, b) => b.reviews - a.reviews);
    if (filterSort === "price") return list.slice().sort((a, b) => a.minPrice - b.minPrice);
    return list;
  }, [sitters, query, serviceFilter, filterMinRating, filterPriceMin, filterPriceMax, filterVerifiedOnly, filterWithReviewsOnly, filterSort]);

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
      {/* Founder feedback : "la search barre il faut la mettre plus vers les
          bords" — closer to the screen edge. Reduced top offset 12 → 4 and
          horizontal padding px-4 → px-2 to push it flush with the safe-area
          and screen sides. */}
      <div
        className="absolute left-0 right-0 z-20 space-y-2 px-2"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 4px)" }}
      >
        {/* Trigger button — opens the full-screen modal with the
            multi-section StickySearchBar (Lieu / Quand / Service). Reads as
            an input visually but is actually a button : the WKWebView keyboard
            on a single map-overlay input was unreliable, and a 3-section bar
            is the right UX for booking-intent searches anyway. */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-full bg-white/95 px-4 py-3 text-left shadow-[0_8px_24px_rgba(2,6,23,0.18)] backdrop-blur active:scale-[0.99]"
          style={{ touchAction: "manipulation" }}
          aria-label="Ouvrir la recherche détaillée"
        >
          <Search className="h-5 w-5 text-slate-500" />
          <span className="flex-1 truncate text-base text-slate-400">
            Lieu, dates, service…
          </span>
        </button>

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
      {/* Bottom offset adds : 140px (sheet collapsed) + 16px breathing room +
          the native bottom-nav height (--ds-bottom-nav-h, exposed by
          MobileBottomNav). The sheet itself sits above the nav too, so it
          all stacks cleanly. */}
      <button
        type="button"
        onClick={handleLocate}
        aria-label="Me localiser"
        className="absolute right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_6px_18px_rgba(2,6,23,0.25)] active:scale-95"
        style={{
          bottom: sheetOpen
            ? "calc(70vh + 16px)"
            : "calc(148px + 32px + max(var(--ds-bottom-nav-h, 0px), 88px))",
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
            bottom: "calc(148px + 32px + max(var(--ds-bottom-nav-h, 0px), 88px))",
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
      {/* Sits ABOVE the native bottom-nav (offset by --ds-bottom-nav-h). The
          bottom-nav already accounts for the safe-area home indicator, so we
          don't add env(safe-area-inset-bottom) here — otherwise we'd double
          up the offset. */}
      {/* Sheet floats as a card with side margins (mx-2 = 8px) above the nav
          bar — aligns with the new bottom-nav inset (also mx-2) for visual
          consistency. 160px collapsed, 16px gap above the nav so the rounded
          card is CLEARLY separated from the nav and never visually overlaps
          it (founder bug : "il passe sous la nav barre ca doit etre séparé
          distinctement"). */}
      <div
        className={`absolute left-2 right-2 z-30 rounded-3xl bg-white shadow-[0_-8px_24px_rgba(2,6,23,0.14)] transition-transform duration-300 ease-out`}
        style={{
          // Floor the nav height with max(…, 88px): when returning to the map
          // from another tab the `--ds-bottom-nav-h` var can momentarily read
          // 0 (the bottom-nav re-measures a tick later), which dropped the
          // sheet's bottom to 16px and hid its lower half behind the z-50 nav
          // (founder: "quand je reviens sur la home la preview se remet en
          // dessous de la nav barre"). The floor guarantees the sheet always
          // clears the nav; once the real (larger) value lands, max() uses it.
          bottom: "calc(max(var(--ds-bottom-nav-h, 0px), 88px) + 16px)",
          // Collapsed peek hugs its content: drag handle (~18px) + header
          // (~36px) + one card row (~68px) ≈ 122px, +slack = 148px. 212px left
          // ~80px of empty white above the nav (founder: "ya un espace enorme
          // entre la nav barre et la carte"). 160px clipped the card; 148px is
          // the sweet spot — full card visible, no empty gap.
          height: sheetOpen ? "calc(70vh - var(--ds-bottom-nav-h, 0px))" : "148px",
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
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex items-center gap-1 text-sm font-medium text-[var(--dogshift-blue)]"
              style={{ touchAction: "manipulation" }}
            >
              Filtres
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#7c3aed] px-1.5 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div
          className={`overflow-y-auto px-4 ${sheetOpen ? "pb-32" : "pb-3"}`}
          style={{
            maxHeight: sheetOpen
              ? "calc(70vh - 80px - var(--ds-bottom-nav-h, 0px))"
              : "86px",
          }}
        >
          {/* Skeleton shimmer while the /api/sitters fetch is in flight —
              shown for BOTH collapsed and expanded states so the founder
              never sees a "popping in" gap between the page skeleton and
              the actual cards. */}
          {loading && (
            sheetOpen ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3"
                  >
                    <div className="ds-skel h-14 w-14 rounded-full" />
                    <div className="ds-skel ds-skel-line w-3/4" />
                    <div className="ds-skel ds-skel-line w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-hidden -mx-4 px-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-[160px] flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-2"
                  >
                    <div className="ds-skel h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <div className="ds-skel ds-skel-line w-full" />
                      <div className="ds-skel ds-skel-line w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {!loading && filteredSitters.length === 0 && (
            <div className="py-6 text-center text-sm text-slate-500">
              Aucun dogsitter trouvé
            </div>
          )}

          {/* Expanded = 2-col grid (cards "côte à côte", like the web home).
              Collapsed = horizontal scroll of small cards. */}
          {!loading && (
            <div className={sheetOpen ? "grid grid-cols-2 gap-3" : "flex gap-3 overflow-x-auto -mx-4 px-4"}>
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
                      ? "flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-center active:scale-[0.99]"
                      : "flex-shrink-0 w-[160px] flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2"
                  }
                  style={{ touchAction: "manipulation" }}
                >
                  <img
                    src={s.avatar}
                    alt=""
                    className={sheetOpen ? "h-14 w-14 rounded-full object-cover" : "h-10 w-10 rounded-full object-cover"}
                  />
                  <div className={sheetOpen ? "min-w-0 w-full" : "min-w-0 flex-1"}>
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {s.name}
                    </div>
                    <div className="truncate text-xs text-slate-500">{s.city}</div>
                    {s.rating !== null && (
                      <div className={`mt-0.5 flex items-center gap-0.5 text-xs text-slate-600 ${sheetOpen ? "justify-center" : ""}`}>
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {s.rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top-anchored search panel ─────────────────────────────────── */}
      {/* Slides DOWN under the search bar, ends above the bottom nav so the
          purple submit CTA is always visible. Inline custom calendar (no
          native iOS full-screen picker — founder : "natif ios mais faudrait
          faire un truc plus épuré et qui s'affiche vers le bas"). Pension
          gets a 2-tap range (arrivée → départ), other services single date. */}
      {searchOpen && (
        <>
          {/* Backdrop — no backdrop-filter; iOS WKWebView has documented
              issues with backdrop-filter on or near focusable inputs that
              prevent the keyboard from appearing even though focus fires. */}
          <button
            type="button"
            aria-label="Fermer la recherche"
            onClick={() => setSearchOpen(false)}
            className="fixed inset-0 z-[990] bg-black/30"
            style={{ touchAction: "manipulation" }}
          />
          {/* Panel — no overflow-hidden, no inner overflow-y-auto. The combo
              of position:fixed + overflow on an ancestor of an input is a
              known iOS WKWebView keyboard blocker. Inner content is sized to
              fit the typical phone viewport without scrolling. */}
          <div
            className="fixed left-2 right-2 z-[1000] flex flex-col rounded-3xl bg-white shadow-[0_20px_60px_rgba(2,6,23,0.30)]"
            style={{
              top: "calc(env(safe-area-inset-top, 0px) + 70px)",
              bottom: "calc(var(--ds-bottom-nav-h, 0px) + 8px)",
            }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
              {/* Left slot : back arrow when in filters subview, else the
                  title. The header swap makes the filter view feel like a
                  "second page" (founder request : "comme une deuxieme page"). */}
              {searchPanelView === "filters" ? (
                <button
                  type="button"
                  onClick={() => setSearchPanelView("main")}
                  className="flex items-center gap-1.5 text-base font-semibold text-slate-900 active:opacity-70"
                  aria-label="Retour à la recherche"
                  style={{ touchAction: "manipulation" }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Filtres
                </button>
              ) : (
                <h2 className="text-base font-semibold text-slate-900">Rechercher</h2>
              )}
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setSearchPanelView("main"); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 active:scale-95"
                aria-label="Fermer"
                style={{ touchAction: "manipulation" }}
              >
                <X className="h-4 w-4 text-slate-700" />
              </button>
            </div>

            {searchPanelView === "main" ? (
            <div className="flex-1 overflow-y-auto space-y-3 px-5 py-3">
              {/* Service chips */}
              <div className="flex gap-2">
                {ALL_SERVICES.map((s) => {
                  const active = searchService === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSearchService(s);
                        // Reset dates on service change so single ↔ range never overlap
                        if (s === "Pension") { setSearchDate(null); }
                        else { setSearchDateStart(null); setSearchDateEnd(null); }
                      }}
                      className={
                        active
                          ? "flex-1 rounded-full bg-[#7c3aed] py-2 text-sm font-semibold text-white"
                          : "flex-1 rounded-full bg-slate-100 py-2 text-sm font-medium text-slate-700"
                      }
                      style={{ touchAction: "manipulation" }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              {/* Lieu — explicit ref + onTouchEnd focus(). iOS WKWebView with
                  fixed-position parents often fires the focus event WITHOUT
                  showing the keyboard. A manual focus call inside a touch
                  event handler is the documented workaround that forces the
                  keyboard to appear. */}
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  Lieu
                </div>
                <input
                  ref={lieuInputRef}
                  type="text"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  onTouchEnd={() => { lieuInputRef.current?.focus(); }}
                  placeholder="Lausanne, Genève, Montreux…"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#7c3aed]"
                  autoComplete="off"
                  inputMode="text"
                  enterKeyHint="next"
                  style={{ fontSize: "16px" }}
                />
              </div>

              {/* Quand — custom inline calendar, no native iOS picker */}
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  Quand
                </div>
                <button
                  type="button"
                  onClick={() => setCalendarOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-base text-slate-900 active:scale-[0.99]"
                  style={{ touchAction: "manipulation" }}
                >
                  <span className={(isPension ? !searchDateStart : !searchDate) ? "text-slate-400" : ""}>
                    {isPension
                      ? (searchDateStart
                          ? `${formatDateFR(searchDateStart)}${searchDateEnd ? ` → ${formatDateFR(searchDateEnd)}` : " → ?"}`
                          : "Arrivée → Départ")
                      : (searchDate ? formatDateFR(searchDate) : "Choisir une date")}
                  </span>
                  <Calendar className="h-4 w-4 text-slate-400" />
                </button>

                {calendarOpen && (
                  <InlineCalendar
                    month={calMonth}
                    onMonthChange={setCalMonth}
                    selectedSingle={isPension ? null : searchDate}
                    selectedStart={isPension ? searchDateStart : null}
                    selectedEnd={isPension ? searchDateEnd : null}
                    rangeMode={isPension}
                    onDayTap={handleDayTap}
                  />
                )}
              </div>

              {/* Chiens */}
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">Chiens</div>
                <div className="space-y-2">
                  {([
                    { label: "Petit", sub: "< 10 kg", count: dogPetit, set: setDogPetit },
                    { label: "Moyen", sub: "10–25 kg", count: dogMoyen, set: setDogMoyen },
                    { label: "Grand", sub: "> 25 kg", count: dogGrand, set: setDogGrand },
                  ] as const).map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2.5">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                        <div className="text-xs text-slate-500">{row.sub}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => row.set(Math.max(0, row.count - 1))}
                          disabled={row.count === 0}
                          aria-label={`Retirer un chien ${row.label}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 disabled:opacity-30 active:scale-95"
                          style={{ touchAction: "manipulation" }}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold text-slate-900">{row.count}</span>
                        <button
                          type="button"
                          onClick={() => row.set(row.count + 1)}
                          aria-label={`Ajouter un chien ${row.label}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 active:scale-95"
                          style={{ touchAction: "manipulation" }}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* "Filtres avancés" trigger — slides to the filter subview */}
              <button
                type="button"
                onClick={() => setSearchPanelView("filters")}
                className="mt-1 flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 active:scale-[0.99]"
                style={{ touchAction: "manipulation" }}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Filtres avancés</div>
                    <div className="text-xs text-slate-500">
                      {activeFilterCount > 0
                        ? `${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""} actif${activeFilterCount > 1 ? "s" : ""}`
                        : "Note, prix, vérification, tri…"}
                    </div>
                  </div>
                </div>
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#7c3aed] px-1.5 text-[11px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            ) : (
              <FilterBody
                filterMinRating={filterMinRating}        setFilterMinRating={setFilterMinRating}
                priceMin={PRICE_MIN}                     priceMax={PRICE_MAX}
                filterPriceMin={filterPriceMin}          setFilterPriceMin={setFilterPriceMin}
                filterPriceMax={filterPriceMax}          setFilterPriceMax={setFilterPriceMax}
                filterVerifiedOnly={filterVerifiedOnly}  setFilterVerifiedOnly={setFilterVerifiedOnly}
                filterWithReviewsOnly={filterWithReviewsOnly} setFilterWithReviewsOnly={setFilterWithReviewsOnly}
                filterSort={filterSort}                  setFilterSort={setFilterSort}
              />
            )}

            {/* Footer — Submit (search view) OR Apply (filters view) */}
            <div className="border-t border-slate-100 px-5 py-3 shrink-0">
              {searchPanelView === "main" ? (
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#7c3aed] py-3 text-base font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] active:scale-[0.98]"
                  style={{ touchAction: "manipulation" }}
                >
                  <Search className="h-4 w-4" />
                  Rechercher
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={activeFilterCount === 0}
                    className="rounded-full border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-40"
                    style={{ touchAction: "manipulation" }}
                  >
                    Réinitialiser
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchPanelView("main")}
                    className="flex-1 rounded-full bg-[#7c3aed] py-3 text-base font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] active:scale-[0.98]"
                    style={{ touchAction: "manipulation" }}
                  >
                    Appliquer
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Filter popup ───────────────────────────────────────────────── */}
      {/* Triggered by the "Filtres" link in the sitter sheet. Refines the
          map + sheet results in place (no /search redirect). Same top-
          anchored layout as the search panel for visual consistency. */}
      {filtersOpen && (
        <>
          <button
            type="button"
            aria-label="Fermer les filtres"
            onClick={() => setFiltersOpen(false)}
            className="fixed inset-0 z-[990] bg-black/30"
            style={{ touchAction: "manipulation" }}
          />
          <div
            className="fixed left-2 right-2 z-[1000] flex flex-col rounded-3xl bg-white shadow-[0_20px_60px_rgba(2,6,23,0.30)]"
            style={{
              top: "calc(env(safe-area-inset-top, 0px) + 70px)",
              bottom: "calc(var(--ds-bottom-nav-h, 0px) + 8px)",
            }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-semibold text-slate-900">Filtres</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 active:scale-95"
                aria-label="Fermer"
                style={{ touchAction: "manipulation" }}
              >
                <X className="h-4 w-4 text-slate-700" />
              </button>
            </div>

            <FilterBody
              filterMinRating={filterMinRating}        setFilterMinRating={setFilterMinRating}
              priceMin={PRICE_MIN}                     priceMax={PRICE_MAX}
              filterPriceMin={filterPriceMin}          setFilterPriceMin={setFilterPriceMin}
              filterPriceMax={filterPriceMax}          setFilterPriceMax={setFilterPriceMax}
              filterVerifiedOnly={filterVerifiedOnly}  setFilterVerifiedOnly={setFilterVerifiedOnly}
              filterWithReviewsOnly={filterWithReviewsOnly} setFilterWithReviewsOnly={setFilterWithReviewsOnly}
              filterSort={filterSort}                  setFilterSort={setFilterSort}
            />

            <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 shrink-0">
              <button
                type="button"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className="rounded-full border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-40"
                style={{ touchAction: "manipulation" }}
              >
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex-1 rounded-full bg-[#7c3aed] py-3 text-base font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] active:scale-[0.98]"
                style={{ touchAction: "manipulation" }}
              >
                Voir {filteredSitters.length} dogsitter{filteredSitters.length > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── InlineCalendar ────────────────────────────────────────────────────────
// Compact month-view calendar with prev/next nav. Supports single-day select
// (default) and range select (`rangeMode={true}` for Pension). Past days
// disabled. Same brand purple (#7c3aed) as the rest of the panel.
function InlineCalendar({
  month,
  onMonthChange,
  selectedSingle,
  selectedStart,
  selectedEnd,
  rangeMode,
  onDayTap,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  selectedSingle: string | null;
  selectedStart: string | null;
  selectedEnd: string | null;
  rangeMode: boolean;
  onDayTap: (iso: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const y = month.getFullYear();
  const m = month.getMonth();
  const firstOfMonth = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  // Mon-first (1) … Sun (0 → 7). JS getDay returns 0=Sun. Shift to Mon-first.
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;

  const monthLabel = month.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const inRange = (iso: string) =>
    rangeMode && selectedStart && selectedEnd && iso > selectedStart && iso < selectedEnd;

  const canGoPrev = !(y === today.getFullYear() && m === today.getMonth());

  return (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => canGoPrev && onMonthChange(new Date(y, m - 1, 1))}
          disabled={!canGoPrev}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-700 disabled:text-slate-300 active:scale-95"
          aria-label="Mois précédent"
          style={{ touchAction: "manipulation" }}
        >
          ‹
        </button>
        <div className="text-sm font-semibold capitalize text-slate-900">{monthLabel}</div>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(y, m + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-700 active:scale-95"
          aria-label="Mois suivant"
          style={{ touchAction: "manipulation" }}
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (<div key={i}>{d}</div>))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const past = iso < todayIso;
          const isToday = iso === todayIso;
          const isSelected =
            (selectedSingle && iso === selectedSingle) ||
            (rangeMode && (iso === selectedStart || iso === selectedEnd));
          const isInRange = inRange(iso);
          const day = Number(iso.slice(-2));
          return (
            <button
              key={i}
              type="button"
              disabled={past}
              onClick={() => onDayTap(iso)}
              style={{ touchAction: "manipulation" }}
              className={[
                "flex h-9 items-center justify-center rounded-full text-sm transition",
                past
                  ? "text-slate-300"
                  : isSelected
                    ? "bg-[#7c3aed] font-semibold text-white"
                    : isInRange
                      ? "bg-[#7c3aed]/15 text-slate-900"
                      : isToday
                        ? "font-semibold text-[#7c3aed]"
                        : "text-slate-700 active:bg-slate-100",
              ].join(" ")}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── FilterBody ────────────────────────────────────────────────────────────
// Shared filter form used by BOTH (a) the in-search-panel "Filtres" subview
// and (b) the standalone filter popup (opened from the sitter sheet). All
// state lives in the parent (NativeMapHome) so closing one entry point and
// opening the other shows the same selections.
function FilterBody({
  filterMinRating, setFilterMinRating,
  priceMin, priceMax,
  filterPriceMin, setFilterPriceMin,
  filterPriceMax, setFilterPriceMax,
  filterVerifiedOnly, setFilterVerifiedOnly,
  filterWithReviewsOnly, setFilterWithReviewsOnly,
  filterSort, setFilterSort,
}: {
  filterMinRating: number;     setFilterMinRating: (v: number) => void;
  priceMin: number;            priceMax: number;
  filterPriceMin: number;      setFilterPriceMin: (v: number) => void;
  filterPriceMax: number;      setFilterPriceMax: (v: number) => void;
  filterVerifiedOnly: boolean; setFilterVerifiedOnly: (v: boolean) => void;
  filterWithReviewsOnly: boolean; setFilterWithReviewsOnly: (v: boolean) => void;
  filterSort: "default" | "rating" | "reviews" | "price";
  setFilterSort: (v: "default" | "rating" | "reviews" | "price") => void;
}) {
  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
      {/* Note minimale */}
      <div>
        <div className="mb-2 text-xs font-medium text-slate-500">Note minimale</div>
        <div className="flex flex-wrap gap-2">
          {[
            { v: 0,   label: "Toutes" },
            { v: 4,   label: "4★+" },
            { v: 4.5, label: "4.5★+" },
            { v: 4.8, label: "4.8★+" },
          ].map((opt) => (
            <FilterChip
              key={opt.v}
              active={filterMinRating === opt.v}
              onClick={() => setFilterMinRating(opt.v)}
            >
              {opt.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Prix par jour */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-medium text-slate-500">Prix par jour</span>
          <span className="text-sm font-semibold text-slate-900">
            {filterPriceMin} – {filterPriceMax === priceMax ? `${priceMax}+` : filterPriceMax} CHF
          </span>
        </div>
        <DualRangeSlider
          min={priceMin}
          max={priceMax}
          step={5}
          valueMin={filterPriceMin}
          valueMax={filterPriceMax}
          onChangeMin={setFilterPriceMin}
          onChangeMax={setFilterPriceMax}
        />
      </div>

      <FilterToggle
        title="Vérifiés uniquement"
        subtitle="Profils avec pièce d'identité validée"
        value={filterVerifiedOnly}
        onChange={setFilterVerifiedOnly}
      />

      <FilterToggle
        title="Avec avis"
        subtitle="Au moins une évaluation laissée par un propriétaire"
        value={filterWithReviewsOnly}
        onChange={setFilterWithReviewsOnly}
      />

      {/* Tri */}
      <div>
        <div className="mb-2 text-xs font-medium text-slate-500">Trier par</div>
        <div className="flex flex-wrap gap-2">
          {([
            { v: "default", label: "Par défaut" },
            { v: "rating",  label: "Mieux notés" },
            { v: "reviews", label: "Plus d'avis" },
            { v: "price",   label: "Prix croissant" },
          ] as const).map((opt) => (
            <FilterChip
              key={opt.v}
              active={filterSort === opt.v}
              onClick={() => setFilterSort(opt.v)}
            >
              {opt.label}
            </FilterChip>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── FilterChip ────────────────────────────────────────────────────────────
// Airbnb-style chip : black-outlined when active (subtle), light gray border
// when not. Replaces the previous solid-purple active state — founder
// feedback : "ya déjà du violet partout, peut etre un truc plus discret".
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ touchAction: "manipulation" }}
      // border-2 on BOTH states (transparent when inactive) so the chip
      // doesn't jitter by 1px when toggled — founder feedback : "elles
      // bougent un peu moi je veux que ca reste statique".
      className={
        active
          ? "rounded-full border-2 border-slate-900 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          : "rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
      }
    >
      {children}
    </button>
  );
}

// ── FilterToggle ──────────────────────────────────────────────────────────
function FilterToggle({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
      style={{ touchAction: "manipulation" }}
    >
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      {/* flex-shrink-0 so the toggle keeps its full 44×24 size even when the
          subtitle wraps to two lines (founder bug : "yen a un le 2e qui est
          un peu coupé"). */}
      <div
        className={
          value
            ? "relative h-6 w-11 shrink-0 rounded-full bg-[#7c3aed] transition"
            : "relative h-6 w-11 shrink-0 rounded-full bg-slate-200 transition"
        }
        aria-hidden="true"
      >
        <div
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition"
          style={{ left: value ? "22px" : "2px" }}
        />
      </div>
    </button>
  );
}

// ── DualRangeSlider ───────────────────────────────────────────────────────
// Two stacked <input type="range"> with custom thumbs. Track + filled range
// painted by overlaid <div>s. The trick : track gets pointer-events: none on
// the input itself, only the ::-webkit-slider-thumb / ::-moz-range-thumb
// catch pointer events. Standard Airbnb-style dual slider in ~50 lines, no
// library.
function DualRangeSlider({
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChangeMin,
  onChangeMax,
}: {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
}) {
  const minPct = ((valueMin - min) / (max - min)) * 100;
  const maxPct = ((valueMax - min) / (max - min)) * 100;
  const thumbClass =
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#7c3aed] [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer " +
    "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#7c3aed] [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer";
  return (
    <div className="relative h-8 select-none">
      <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#7c3aed]"
        style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        onChange={(e) => onChangeMin(Math.min(Number(e.target.value), valueMax - step))}
        aria-label="Prix minimum"
        className={`absolute inset-0 w-full appearance-none bg-transparent pointer-events-none ${thumbClass}`}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        onChange={(e) => onChangeMax(Math.max(Number(e.target.value), valueMin + step))}
        aria-label="Prix maximum"
        className={`absolute inset-0 w-full appearance-none bg-transparent pointer-events-none ${thumbClass}`}
      />
    </div>
  );
}
