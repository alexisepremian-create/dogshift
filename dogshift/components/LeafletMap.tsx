"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import Link from "next/link";
import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import { MOCK_SITTERS } from "@/lib/mockSitters";
import { applyHostProfileToMockSitter, loadHostProfileFromStorage } from "@/lib/hostProfile";

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
  const sitters = useMemo(() => {
    return MOCK_SITTERS.map((s) => {
      const host = loadHostProfileFromStorage(s.id);
      if (!host) return s;
      if (!(host.listingStatus === "published" || Boolean(host.publishedAt))) return s;
      return applyHostProfileToMockSitter(s, host);
    });
  }, []);

  const bounds = useMemo(() => {
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
                href={`/sitter/${sitter.id}`}
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
