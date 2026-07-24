"use client";

import { useEffect, useState } from "react";
import { Camera } from "lucide-react";

type OwnerReport = {
  id: string;
  note: string | null;
  peed: boolean | null;
  pooed: boolean | null;
  drankWater: boolean | null;
  ate: boolean | null;
  played: boolean | null;
  mood: string | null;
  energy: number | null;
  incidents: string | null;
  distanceMeters: number | null;
  sentAt: string | null;
  dogName: string | null;
  photos: { id: string; url: string; caption: string | null }[];
};

const MOOD_LABELS: Record<string, string> = {
  HAPPY: "Heureux", CALM: "Calme", TIRED: "Fatigué", PLAYFUL: "Joueur", ANXIOUS: "Anxieux",
};

function checklistLines(r: OwnerReport): string[] {
  const l: string[] = [];
  if (r.peed) l.push("A fait pipi");
  if (r.pooed) l.push("A fait caca");
  if (r.drankWater) l.push("A bu de l'eau");
  if (r.ate) l.push("A mangé");
  if (r.played) l.push("A joué / câlins");
  if (r.mood && MOOD_LABELS[r.mood]) l.push(`Humeur : ${MOOD_LABELS[r.mood]}`);
  if (typeof r.energy === "number") l.push(`Énergie : ${r.energy}/5`);
  return l;
}

/**
 * Owner-facing "Rapport de service" card. Fetches the SENT report for a booking
 * and renders nothing until one exists — safe to always mount in the detail view.
 */
export default function OwnerServiceReportCard({ bookingId }: { bookingId: string }) {
  const [report, setReport] = useState<OwnerReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/account/bookings/${encodeURIComponent(bookingId)}/report`);
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.ok && json.report) setReport(json.report as OwnerReport);
      } catch {
        /* silent — the card just stays hidden */
      }
    })();
    // Clear on booking change so a stale report never flashes for the wrong booking.
    return () => { cancelled = true; setReport(null); };
  }, [bookingId]);

  if (!report) return null;
  const lines = checklistLines(report);
  const km = typeof report.distanceMeters === "number" && report.distanceMeters > 0 ? (report.distanceMeters / 1000).toFixed(2) : null;

  return (
    <section className="border-t border-slate-100 bg-white p-5">
      <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7c3aed]/10 text-[#7c3aed]">
          <Camera className="h-3.5 w-3.5" />
        </span>
        Rapport de service
      </p>

      {report.photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {report.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt="Photo" className="aspect-square w-full rounded-xl object-cover" />
          ))}
        </div>
      ) : null}

      {km ? <p className="mt-4 text-sm text-slate-600">Distance parcourue : <span className="font-semibold text-slate-900">{km} km</span></p> : null}

      {lines.length > 0 ? (
        <ul className="mt-4 space-y-1">
          {lines.map((l) => (
            <li key={l} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed]" />
              {l}
            </li>
          ))}
        </ul>
      ) : null}

      {report.note?.trim() ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <p className="whitespace-pre-line text-sm italic text-slate-700">&ldquo;{report.note}&rdquo;</p>
        </div>
      ) : null}

      {report.incidents?.trim() ? (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-700">À signaler</p>
          <p className="mt-1 whitespace-pre-line text-sm text-amber-800">{report.incidents}</p>
        </div>
      ) : null}
    </section>
  );
}
