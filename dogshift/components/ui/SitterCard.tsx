import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, Star } from "lucide-react";

export type SitterPreview = {
  sitterId: string;
  displayName: string;
  city: string;
  avatarUrl: string | null;
  verified: boolean;
  services: string[];
  minPrice: number | null;
  averageRating: number | null;
  countReviews: number;
};

const SERVICE_DISPLAY: Record<string, string> = {
  Promenade: "Promenade",
  Garde: "Dogsitting",
  Pension: "Pension",
};

export default function SitterCard({ sitter, priority = false }: { sitter: SitterPreview; priority?: boolean }) {
  const initials = sitter.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  const serviceLabel = sitter.services
    .map((s) => SERVICE_DISPLAY[s] ?? s)
    .join(" · ");

  return (
    <Link
      href={`/sitter/${sitter.sitterId}`}
      className="group block cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--dogshift-blue)]"
    >
      {/* ── Image ────────────────────────────────────────────────── */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-black/[0.04]">
        {sitter.avatarUrl ? (
          <Image
            src={sitter.avatarUrl}
            alt={sitter.displayName}
            fill
            priority={priority}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, 220px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <span className="text-xl font-semibold text-slate-400">{initials || "DS"}</span>
          </div>
        )}

        {sitter.verified && (
          <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 shadow-sm backdrop-blur-sm">
            <BadgeCheck className="h-3 w-3 shrink-0 text-[var(--dogshift-blue)]" aria-hidden="true" />
            <span className="pr-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--dogshift-blue)]">Vérifié</span>
          </div>
        )}
      </div>

      {/* ── Info ─────────────────────────────────────────────────── */}
      <div className="mt-2.5 px-0.5">
        {/* Name + Rating on same row */}
        <div className="flex items-start justify-between gap-1.5">
          <p className="truncate text-sm font-semibold leading-snug text-slate-900">
            {sitter.displayName}
          </p>
          {sitter.averageRating !== null && sitter.countReviews > 0 && (
            <div className="flex shrink-0 items-center gap-0.5 pt-px">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="text-xs font-medium text-slate-700">
                {sitter.averageRating.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* City */}
        {sitter.city ? (
          <div className="mt-1 flex items-center gap-1 text-slate-500">
            <MapPin className="h-[13px] w-[13px] shrink-0 text-slate-400" strokeWidth={2.25} aria-hidden="true" />
            <p className="truncate text-xs">{sitter.city}</p>
          </div>
        ) : null}

        {/* Services */}
        {serviceLabel ? (
          <p className="mt-0.5 truncate text-xs text-slate-400">{serviceLabel}</p>
        ) : null}

        {/* Price */}
        <p className="mt-1.5 text-sm text-slate-700">
          {sitter.minPrice !== null ? (
            <>
              <span className="text-slate-400 text-xs">À partir de </span>
              <span className="font-semibold text-slate-900">CHF {sitter.minPrice}.–</span>
            </>
          ) : (
            <span className="text-xs text-slate-400">Sur demande</span>
          )}
        </p>
      </div>
    </Link>
  );
}
