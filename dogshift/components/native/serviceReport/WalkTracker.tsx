"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Play, Square, Loader2 } from "lucide-react";

import { cleanRoute, routeDistanceMeters, type LatLng } from "@/lib/serviceReport/track";
import { buildRouteMapUrl } from "@/lib/serviceReport/routeStaticMap";

type Props = {
  bookingId: string;
  initialRoute?: LatLng[] | null;
  initialDistanceMeters?: number | null;
};

function kmLabel(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Optional GPS walk-tracking module for the report composer. Uses Capacitor
 * Geolocation (native) / the browser geolocation fallback to record a polyline,
 * then persists it via PUT …/report/track and shows a route map.
 */
export default function WalkTracker({ bookingId, initialRoute, initialDistanceMeters }: Props) {
  const [recording, setRecording] = useState(false);
  const [distance, setDistance] = useState<number>(initialDistanceMeters ?? 0);
  const [route, setRoute] = useState<LatLng[]>(() => (Array.isArray(initialRoute) ? initialRoute : []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<string | null>(null);
  const pointsRef = useRef<LatLng[]>([]);
  const startedAtRef = useRef<string | null>(null);

  // Best-effort cleanup if the sitter navigates away mid-recording.
  useEffect(() => {
    return () => {
      const id = watchIdRef.current;
      if (id) import("@capacitor/geolocation").then(({ Geolocation }) => Geolocation.clearWatch({ id })).catch(() => {});
    };
  }, []);

  const start = async () => {
    setError(null);
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      try {
        await Geolocation.requestPermissions();
      } catch {
        /* web fallback doesn't implement requestPermissions */
      }
      pointsRef.current = [];
      startedAtRef.current = new Date().toISOString();
      setRoute([]);
      setDistance(0);
      const id = await Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
        if (err || !pos) return;
        const next: LatLng = [pos.coords.latitude, pos.coords.longitude];
        const cleaned = cleanRoute([...pointsRef.current, next]);
        pointsRef.current = cleaned;
        setRoute(cleaned);
        setDistance(routeDistanceMeters(cleaned));
      });
      watchIdRef.current = id;
      setRecording(true);
    } catch {
      setError("Le GPS n'est pas disponible.");
    }
  };

  const stop = async () => {
    setRecording(false);
    const id = watchIdRef.current;
    watchIdRef.current = null;
    if (id) {
      try {
        const { Geolocation } = await import("@capacitor/geolocation");
        await Geolocation.clearWatch({ id });
      } catch {
        /* ignore */
      }
    }
    const finalRoute = pointsRef.current;
    if (finalRoute.length < 2) {
      setError("Balade trop courte pour être enregistrée.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/host/bookings/${encodeURIComponent(bookingId)}/report/track`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          route: finalRoute,
          distanceMeters: routeDistanceMeters(finalRoute),
          trackStartedAt: startedAtRef.current,
          trackEndedAt: new Date().toISOString(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError("L'enregistrement du parcours a échoué.");
        return;
      }
      if (typeof json.distanceMeters === "number") setDistance(json.distanceMeters);
    } catch {
      setError("L'enregistrement du parcours a échoué.");
    } finally {
      setSaving(false);
    }
  };

  const mapUrl = !recording && route.length >= 2 ? buildRouteMapUrl({ route, width: 720, height: 360 }) : null;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Parcours GPS</h2>
        {distance > 0 ? <span className="text-sm font-semibold text-[#7c3aed]">{kmLabel(distance)}</span> : null}
      </div>

      {mapUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mapUrl} alt="Parcours de la balade" className="mb-3 w-full rounded-2xl object-cover" style={{ aspectRatio: "2 / 1" }} />
      ) : null}

      {recording ? (
        <button
          type="button"
          onClick={stop}
          disabled={saving}
          style={{ touchAction: "manipulation" }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-base font-semibold text-white active:scale-[0.99] disabled:opacity-70"
        >
          <Square className="h-5 w-5" /> Arrêter la balade
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={saving}
          style={{ touchAction: "manipulation" }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 text-base font-semibold text-slate-800 active:scale-[0.99] disabled:opacity-70"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : route.length >= 2 ? <MapPin className="h-5 w-5 text-[#7c3aed]" /> : <Play className="h-5 w-5 text-[#7c3aed]" />}
          {route.length >= 2 ? "Refaire le parcours" : "Démarrer la balade"}
        </button>
      )}

      {recording ? (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Enregistrement en cours…
        </p>
      ) : null}
      {error ? <p className="mt-2 text-center text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
