"use client";

import { MapPin } from "lucide-react";

/**
 * Purple geolocation loader — a pin with expanding radar rings (Tailwind
 * `animate-ping`). Used while the deck / profiles load and while acquiring the
 * device position.
 */
export default function GeoLoader({ label = "On cherche autour de toi…" }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span className="absolute inline-flex h-20 w-20 rounded-full bg-[#7c3aed]/30 animate-ping" />
        <span className="absolute inline-flex h-14 w-14 rounded-full bg-[#7c3aed]/20 animate-ping [animation-delay:0.5s]" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-[0_10px_28px_rgba(124,58,237,0.5)]">
          <MapPin className="h-8 w-8" fill="currentColor" strokeWidth={1.5} />
        </span>
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}
