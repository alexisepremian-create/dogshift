/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
 
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/role-supports-aria-props */
"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { User, Scissors, Dog, MapPin, Users, MessageSquare, Star, Info, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Shield, CreditCard, MessageCircle } from "lucide-react";
import { SERVICE_COLORS, getServiceColors } from "@/lib/design/services";
import SharedCalendar, { type DayAvailability } from "@/components/ui/Calendar";
import { loadHostProfileFromStorage, type HostProfileV1 } from "@/lib/hostProfile";
import HostDashboardShell from "@/components/HostDashboardShell";
import { HostUserProvider, makeHostUserValuePreview } from "@/components/HostUserProvider";
import { DogSizeIcon } from "@/components/DogSizeIcon";
import { appendHostMessage } from "@/lib/hostMessages";
import { BUCKET_LABELS_FR, bucketDetailFr, mapReasonToBucket } from "@/lib/availability/reasonBuckets";
import AccountPageSkeleton from "@/components/ui/AccountPageSkeleton";
import { useMaintenance } from "@/components/platform/MaintenanceProvider";
import { maintenanceBookingUserMessage } from "@/lib/platform/maintenanceConstants";

type ServiceType = "Promenade" | "Garde" | "Pension";

type PricingMap = Record<string, number>;

type SitterReview = {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  authorName: string;
  anonymous: boolean;
  createdAt: string;
};

type BoardingDetailsCard = {
  housingType: "Appartement" | "Maison" | null;
  hasGarden: boolean | null;
  hasOtherPets: boolean | null;
  notes: string | null;
  pensionAcceptedSizes: string[] | null;
};

type SitterCard = {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  rating: number | null;
  reviewCount: number;
  pricePerDay: number;
  services: string[];
  dogSizes: string[];
  maxDogsBySize?: Record<string, number>;
  acceptanceCriteria?: { neuteredRequired?: boolean; maxDogs?: number | null } | null;
  capacityPlaces?: number;
  acceptsSmall?: boolean;
  acceptsMedium?: boolean;
  acceptsLarge?: boolean;
  neuteredRequired?: boolean;
  availableDates: string[];
  pricing: PricingMap;
  bio: string;
  responseTime: string;
  verified: boolean;
  trustBadgeEligible: boolean;
  lat: number;
  lng: number;
  avatarUrl: string;
  reviews: SitterReview[];
  boardingDetails: BoardingDetailsCard | null;
};

type BookingStep = "form" | "confirm" | "sent";

type AvailabilityPayload = { ok?: boolean; dates?: string[]; error?: string };

const DOG_SIZE_ORDER = ["Petit", "Moyen", "Grand"] as const;

function formatRating(rating: number) {
  return rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
}

function Tooltip({
  label,
  children,
}: {
  label: string;
  children: (opts: { triggerProps: { onMouseEnter: () => void; onMouseLeave: () => void; onFocus: () => void; onBlur: () => void; "aria-describedby": string } }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useMemo(() => `tt-${Math.random().toString(16).slice(2)}`, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <span className="relative flex w-full">
      {children({
        triggerProps: {
          onMouseEnter: () => setOpen(true),
          onMouseLeave: () => setOpen(false),
          onFocus: () => setOpen(true),
          onBlur: () => setOpen(false),
          "aria-describedby": id,
        },
      })}
      {open && label ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 shadow-lg"
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function formatRatingMaybe(rating: number | null) {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return "—";
  return formatRating(rating);
}

function formatDateFr(iso: string) {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short" }).format(dt);
}

function formatDateDisplay(iso: string) {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatReviewDate(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", year: "numeric" }).format(dt);
}

function safeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function safeDogSizes(value: unknown) {
  const found = new Set<(typeof DOG_SIZE_ORDER)[number]>();
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry === "Petit" || entry === "Moyen" || entry === "Grand") found.add(entry);
    }
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of DOG_SIZE_ORDER) {
      if (obj[key] === true) found.add(key);
    }
  }
  return DOG_SIZE_ORDER.filter((size) => found.has(size));
}

function safePricingMap(value: unknown) {
  if (!value || typeof value !== "object") return {} as PricingMap;
  const obj = value as Record<string, unknown>;
  const out: PricingMap = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return out;
}

function serviceLabelToSlotsType(service: string): "PROMENADE" | "DOGSITTING" | "PENSION" {
  if (service === "Promenade") return "PROMENADE";
  if (service === "Garde") return "DOGSITTING";
  return "PENSION";
}


function statusForSelectedService(
  row:
    | {
        promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
        dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
        pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
        promenadePartial?: boolean;
        dogsittingPartial?: boolean;
        pensionPartial?: boolean;
      }
    | undefined,
  serviceType: "PROMENADE" | "DOGSITTING" | "PENSION"
) {
  if (!row) return "UNAVAILABLE" as const;
  if (serviceType === "PROMENADE") return row.promenadeStatus;
  if (serviceType === "DOGSITTING") return row.dogsittingStatus;
  return row.pensionStatus;
}

function partialForSelectedService(
  row:
    | {
        promenadePartial?: boolean;
        dogsittingPartial?: boolean;
        pensionPartial?: boolean;
      }
    | undefined,
  serviceType: "PROMENADE" | "DOGSITTING" | "PENSION"
) {
  if (!row) return false;
  if (serviceType === "PROMENADE") return Boolean(row.promenadePartial);
  if (serviceType === "DOGSITTING") return Boolean(row.dogsittingPartial);
  return Boolean(row.pensionPartial);
}

function formatSelectionRange(start: string, end?: string) {
  if (!start) return "";
  if (!end) return formatDateFr(start);
  return `${formatDateFr(start)} → ${formatDateFr(end)}`;
}

function formatTimeLabel(iso: string) {
  const hour = iso.slice(11, 13);
  const minute = iso.slice(14, 16);
  if (!hour || !minute) return iso;
  return `${hour}:${minute}`;
}

function todayZurichIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getAvailabilityLoadErrorMessage(error: string | null | undefined) {
  const code = typeof error === "string" ? error.trim() : "";
  if (!code) return "Impossible de charger l’agenda pour le moment.";
  if (code === "DAY_STATUS_NETWORK_ERROR") return "Impossible de charger l’agenda pour le moment.";
  if (code === "INTERNAL_ERROR") return "Impossible de charger l’agenda pour le moment.";
  if (code === "TIMEOUT") return "Le chargement de l’agenda prend plus de temps que prévu.";
  return "Impossible de charger l’agenda pour le moment.";
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.366 2.447a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.447a1 1 0 00-1.176 0l-3.366 2.447c-.784.57-1.838-.197-1.54-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.102 9.384c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysBetweenInclusive(start: string, end: string) {
  if (!isValidIsoDate(start) || !isValidIsoDate(end)) return 1;
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  const diff = Math.round((b - a) / (24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-40px_rgba(2,6,23,0.55)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            aria-label="Fermer"
          >
            Fermer
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function SitterPublicProfile() {
  const params = useParams<{ sitterId: string }>();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const rawIdParam = params?.sitterId;
  const rawId = typeof rawIdParam === "string" ? rawIdParam : Array.isArray(rawIdParam) ? rawIdParam[0] : "";
  const sitterId = rawId && rawId.startsWith("s-") ? rawId : rawId ? `s-${rawId}` : "";
  const dbg = searchParams?.get("dbg") === "1";
  const viewMode = (searchParams?.get("mode") ?? "public").trim() || "public";
  const isPreviewMode = viewMode === "preview";
  const search = searchParams?.toString?.() ?? "";

  if (dbg) {
    console.log("[SitterPage] rawId=", rawId, "normalized=", sitterId, "preview=", isPreviewMode);
  }
  if (dbg) console.log("[SitterPage] render complete");
  return (
    <SitterPublicProfileContent
      sitterId={sitterId}
      isPreviewMode={isPreviewMode}
      dbg={dbg}
      pathname={pathname}
      search={search}
    />
  );
}

function SitterPublicProfileContent({
  sitterId,
  isPreviewMode,
  dbg,
  pathname,
  search,
}: {
  sitterId: string;
  isPreviewMode: boolean;
  dbg: boolean;
  pathname: string;
  search: string;
}) {
  const router = useRouter();
  const { maintenanceMode, adminNote } = useMaintenance();
  if (dbg) console.log("[ProfileContent] render");
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const id = sitterId;
  if (dbg) console.log("ID used for fetch:", id);

  const { isLoaded, isSignedIn, user } = useUser();
  const isLoggedIn = Boolean(isLoaded && isSignedIn);
  const effectivePreviewMode = Boolean(isPreviewMode && isLoggedIn);

  const [hydrated, setHydrated] = useState(false);
  const [currentHostId, setCurrentHostId] = useState<string | null>(null);
  const [hostProfileCompletion, setHostProfileCompletion] = useState<number | null>(null);
  const [hostProfileCompletionLoaded, setHostProfileCompletionLoaded] = useState(false);

  const [apiSitter, setApiSitter] = useState<SitterCard | null>(null);
  const [apiLoaded, setApiLoaded] = useState(false);

  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  const viewMode = effectivePreviewMode ? "preview" : "public";
  const isPublicView = !effectivePreviewMode;
  const isHostViewingOwn = Boolean(currentHostId && id && currentHostId === id);

  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewSitter, setPreviewSitter] = useState<SitterCard | null>(null);
  const [profileData, setProfileData] = useState<HostProfileV1 | null>(null);

  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    if (!photoLightboxOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPhotoLightboxOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photoLightboxOpen]);

  const sessionName = typeof user?.fullName === "string" ? user.fullName : "";
  const sessionImage = typeof user?.imageUrl === "string" ? user.imageUrl : null;

  useEffect(() => {
    if (!isPreviewMode) return;
    if (!isLoaded) return;
    if (isSignedIn) return;

    const nextParams = new URLSearchParams(search);
    nextParams.delete("mode");
    const tail = nextParams.toString();
    const target = tail ? `${pathname}?${tail}` : pathname;
    router.replace(target);
  }, [isLoaded, isPreviewMode, isSignedIn, pathname, router, search]);

  function buildSitterFromProfile(profile: HostProfileV1): SitterCard {
    const servicesRaw = profile.services && typeof profile.services === "object" ? profile.services : {};
    const services = servicesRaw as Record<string, unknown>;
    const enabledServices = Object.keys(services).filter((k) => Boolean(services[k]));
    const pricing = profile.pricing && typeof profile.pricing === "object" ? (profile.pricing as Record<string, unknown>) : {};

    const pensionRaw = pricing.Pension;
    const pension = typeof pensionRaw === "number" && Number.isFinite(pensionRaw) && pensionRaw > 0 ? pensionRaw : null;
    const hourlyCandidates = ([pricing.Promenade, pricing.Garde] as Array<unknown>).filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0
    );
    const pricePerDay = pension ?? (hourlyCandidates.length ? Math.min(...hourlyCandidates) : 0);

    const dogSizesRaw = profile.dogSizes && typeof profile.dogSizes === "object" ? profile.dogSizes : {};
    const maxDogsBySizeRaw =
      profile.maxDogsBySize && typeof profile.maxDogsBySize === "object"
        ? (profile.maxDogsBySize as Record<string, unknown>)
        : null;
    const maxDogsBySize = maxDogsBySizeRaw
      ? Object.fromEntries(
          DOG_SIZE_ORDER.map((s) => [s, typeof maxDogsBySizeRaw[s] === "number" ? (maxDogsBySizeRaw[s] as number) : 0])
        )
      : undefined;
    const enabledDogSizes = DOG_SIZE_ORDER.filter((size) =>
      maxDogsBySize ? (maxDogsBySize[size] ?? 0) > 0 : Boolean((dogSizesRaw as Record<string, unknown>)[size])
    );

    const bd = profile.boardingDetails;
    const boardingDetails: BoardingDetailsCard | null = bd
      ? {
          housingType: bd.housingType === "Appartement" || bd.housingType === "Maison" ? bd.housingType : null,
          hasGarden: typeof bd.hasGarden === "boolean" ? bd.hasGarden : null,
          hasOtherPets: typeof bd.hasOtherPets === "boolean" ? bd.hasOtherPets : null,
          notes: typeof bd.notes === "string" && bd.notes.trim() ? bd.notes.trim() : null,
          pensionAcceptedSizes: Array.isArray((bd as { pensionAcceptedSizes?: unknown }).pensionAcceptedSizes) && (bd as { pensionAcceptedSizes?: unknown[] }).pensionAcceptedSizes!.length > 0 ? (bd as { pensionAcceptedSizes: string[] }).pensionAcceptedSizes : null,
        }
      : null;

    return {
      id: profile.sitterId,
      name: profile.firstName && profile.firstName.trim() ? profile.firstName.trim() : sessionName,
      city: profile.city ?? "",
      postalCode: profile.postalCode ?? "",
      rating: null,
      reviewCount: 0,
      pricePerDay,
      services: enabledServices ?? [],
      dogSizes: enabledDogSizes,
      maxDogsBySize,
      acceptanceCriteria: (profile as { acceptanceCriteria?: { neuteredRequired?: boolean; maxDogs?: number | null } | null }).acceptanceCriteria ?? null,
      capacityPlaces: profile.capacityPlaces ?? 3,
      acceptsSmall: profile.acceptsSmall,
      acceptsMedium: profile.acceptsMedium,
      acceptsLarge: profile.acceptsLarge,
      neuteredRequired: profile.neuteredRequired,
      availableDates: [],
      pricing: safePricingMap(pricing),
      bio: profile.bio ?? "",
      responseTime: "~1h",
      verified: profile.verificationStatus === "verified",
      trustBadgeEligible: false,
      lat: 0,
      lng: 0,
      avatarUrl:
        profile.avatarDataUrl && profile.avatarDataUrl.trim()
          ? profile.avatarDataUrl
          : (sessionImage ?? "https://i.pravatar.cc/160?img=7"),
      reviews: apiSitter?.reviews ?? [],
      boardingDetails,
    };
  }

  useEffect(() => {
    if (!id) return;
    setApiLoaded(false);
    setApiError(null);
    void (async () => {
      try {
        if (dbg) console.log("[ProfileContent] fetch start");
        const res = await fetch(
          `/api/sitters/${encodeURIComponent(id)}${effectivePreviewMode ? "?mode=preview" : ""}`,
          { cache: "no-store" }
        );
        const payload = (await res.json()) as
          | {
              ok: true;
              sitter: {
                sitterId: string;
                name: string;
                city: string;
                postalCode: string;
                countReviews?: number;
                averageRating?: number | null;
                reviews?: SitterReview[];
                bio: string;
                avatarUrl: string | null;
                services: unknown;
                pricing: unknown;
                dogSizes: unknown;
                acceptanceCriteria?: { neuteredRequired?: boolean; maxDogs?: number | null } | null;
                boardingDetails?: {
                  housingType?: "Appartement" | "Maison" | null;
                  hasGarden?: boolean | null;
                  hasOtherPets?: boolean | null;
                  notes?: string | null;
                  pensionAcceptedSizes?: string[] | null;
                } | null;
                verified?: boolean;
                trustBadgeEligible?: boolean;
                lat: number | null;
                lng: number | null;
              };
            }
          | { ok: false; error: string };

        if (dbg) console.log("API raw response", payload);

        if (!res.ok || !payload.ok) {
          const err = (payload as unknown as { error?: unknown })?.error;
          setApiError(typeof err === "string" ? err : res.status === 403 ? "FORBIDDEN" : "NOT_FOUND");
          setApiSitter(null);
          setProfileData(null);
          setApiLoaded(true);
          return;
        }

        if (dbg) console.log("[ProfileContent] fetch success");

        setProfileData(null);

        const services = safeStringArray(payload.sitter.services);
        const pricing = safePricingMap(payload.sitter.pricing);
        const priceCandidates = Object.values(pricing).filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
        const pricePerDay = priceCandidates.length ? Math.min(...priceCandidates) : 0;

        const sitter: SitterCard = {
          id: payload.sitter.sitterId,
          name: payload.sitter.name ?? "",
          city: payload.sitter.city ?? "",
          postalCode: payload.sitter.postalCode ?? "",
          rating: typeof payload.sitter.averageRating === "number" && Number.isFinite(payload.sitter.averageRating) ? payload.sitter.averageRating : null,
          reviewCount: typeof payload.sitter.countReviews === "number" && Number.isFinite(payload.sitter.countReviews) ? payload.sitter.countReviews : 0,
          pricePerDay,
          services,
          dogSizes: safeDogSizes(payload.sitter.dogSizes),
          acceptanceCriteria: payload.sitter.acceptanceCriteria && typeof payload.sitter.acceptanceCriteria === "object"
            ? (payload.sitter.acceptanceCriteria as { neuteredRequired?: boolean; maxDogs?: number | null })
            : null,
          availableDates: [],
          pricing,
          bio: payload.sitter.bio ?? "",
          responseTime: "~1h",
          verified: typeof payload.sitter.verified === "boolean" ? payload.sitter.verified : false,
          trustBadgeEligible: payload.sitter.trustBadgeEligible === true,
          lat: typeof payload.sitter.lat === "number" && Number.isFinite(payload.sitter.lat) ? payload.sitter.lat : 0,
          lng: typeof payload.sitter.lng === "number" && Number.isFinite(payload.sitter.lng) ? payload.sitter.lng : 0,
          avatarUrl: payload.sitter.avatarUrl ?? "https://i.pravatar.cc/160?img=7",
          reviews: Array.isArray(payload.sitter.reviews) ? payload.sitter.reviews : [],
          boardingDetails: (() => {
            const bd = payload.sitter.boardingDetails;
            if (!bd || typeof bd !== "object") return null;
            const housingType = bd.housingType === "Appartement" || bd.housingType === "Maison" ? bd.housingType : null;
            const hasGarden = typeof bd.hasGarden === "boolean" ? bd.hasGarden : null;
            const hasOtherPets = typeof bd.hasOtherPets === "boolean" ? bd.hasOtherPets : null;
            const notes = typeof bd.notes === "string" && bd.notes.trim() ? bd.notes.trim() : null;
            const pensionAcceptedSizes = Array.isArray(bd.pensionAcceptedSizes) && bd.pensionAcceptedSizes.length > 0 ? bd.pensionAcceptedSizes as string[] : null;
            if (!housingType && hasGarden == null && hasOtherPets == null && !notes && !pensionAcceptedSizes) return null;
            return { housingType, hasGarden, hasOtherPets, notes, pensionAcceptedSizes };
          })(),
        };

        setApiSitter(sitter);
        if (dbg) console.log("After setSitter", sitter);
        setApiLoaded(true);
      } catch (error) {
        if (dbg) console.log("[ProfileContent] fetch error", error);
        setApiError("NETWORK_ERROR");
        setApiSitter(null);
        setProfileData(null);
        setApiLoaded(true);
      } finally {
        if (dbg) console.log("[ProfileContent] fetch finally");
      }
    })();
  }, [effectivePreviewMode, id]);

  useEffect(() => {
    if (!id) return;
    setAvailabilityLoaded(true);
    setAvailableDates([]);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    // handled below by the single /api/host/profile fetch
  }, [id]);

  useEffect(() => {
    setHydrated(true);
    setHostProfileCompletionLoaded(false);
    if (!isLoaded || !isSignedIn) {
      setCurrentHostId(null);
      setHostProfileCompletion(null);
      setHostProfileCompletionLoaded(true);
      setPreviewLoaded(false);
      setPreviewSitter(null);
      setProfileData(null);
      return;
    }
    void (async () => {
      try {
        if (dbg) console.log("[ProfileContent] fetch start");
        const res = await fetch("/api/host/profile", { method: "GET", cache: "no-store" });
        const payload = (await res.json()) as {
          ok?: boolean;
          sitterId?: string | null;
          profile?: unknown;
          profileCompletion?: number;
        };
        if (!res.ok || !payload.ok) {
          setCurrentHostId(null);
          setHostProfileCompletion(null);
          setHostProfileCompletionLoaded(true);
          setPreviewLoaded(false);
          setPreviewSitter(null);
          setProfileData(null);
          return;
        }

        if (dbg) console.log("[ProfileContent] fetch success");
        const sitterId = typeof payload.sitterId === "string" ? payload.sitterId : null;
        const normalizedSitterId = sitterId && sitterId.trim() ? sitterId.trim() : null;
        setCurrentHostId(normalizedSitterId);

        setHostProfileCompletion(typeof payload.profileCompletion === "number" && Number.isFinite(payload.profileCompletion) ? payload.profileCompletion : null);
        setHostProfileCompletionLoaded(true);

        if (!id || !normalizedSitterId) {
          setPreviewLoaded(false);
          setPreviewSitter(null);
          setProfileData(null);
          return;
        }

        const shouldLoadPreview = Boolean(effectivePreviewMode && normalizedSitterId === id);
        if (!shouldLoadPreview) {
          setPreviewLoaded(false);
          setPreviewSitter(null);
          setProfileData(null);
          return;
        }

        const remote = payload.profile as HostProfileV1 | null | undefined;
        if (remote && typeof remote === "object" && remote.profileVersion === 1 && remote.sitterId === id) {
          setProfileData(remote);
          setPreviewSitter(buildSitterFromProfile(remote));
          setPreviewLoaded(true);
          return;
        }

        const stored = loadHostProfileFromStorage(id);
        if (stored) {
          setProfileData(stored);
          setPreviewSitter(buildSitterFromProfile(stored));
        } else {
          setProfileData(null);
          setPreviewSitter(null);
        }
        setPreviewLoaded(true);
      } catch (error) {
        if (dbg) console.log("[ProfileContent] fetch error", error);
        setCurrentHostId(null);
        setHostProfileCompletion(null);
        setHostProfileCompletionLoaded(true);
        setPreviewLoaded(false);
        setPreviewSitter(null);
        setProfileData(null);
      } finally {
        if (dbg) console.log("[ProfileContent] fetch finally");
      }
    })();
  }, [effectivePreviewMode, id, isLoaded, isSignedIn]);

  useEffect(() => {
    // handled above
  }, [hydrated]);

  const sitter = useMemo(() => {
    if (effectivePreviewMode && isHostViewingOwn) {
      if (!previewLoaded) return undefined;
      if (previewSitter) {
        return apiSitter
          ? {
              ...previewSitter,
              rating: apiSitter.rating,
              reviewCount: apiSitter.reviewCount,
              trustBadgeEligible: apiSitter.trustBadgeEligible,
              reviews: apiSitter.reviews,
            }
          : previewSitter;
      }

      // If no draft profile is available for preview, fall back to the DB-backed API profile.
      if (!apiLoaded) return undefined;
      return apiSitter ?? null;
    }

    if (!apiLoaded) return undefined;
    return apiSitter ?? null;
  }, [apiLoaded, apiSitter, effectivePreviewMode, isHostViewingOwn, previewLoaded, previewSitter]);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageStep, setMessageStep] = useState<"form" | "sent">("form");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<BookingStep>("form");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");
  const [bookingStartAt, setBookingStartAt] = useState<string>("");
  const [bookingEndAt, setBookingEndAt] = useState<string>("");
  const [bookingMessage, setBookingMessage] = useState("");

  const [selectedSlot, setSelectedSlot] = useState<
    | {
        serviceType: "PROMENADE" | "DOGSITTING";
        dateIso: string;
        startAt: string;
        endAt: string;
        status: "AVAILABLE" | "ON_REQUEST";
        reason?: string;
      }
    | null
  >(null);
  const [selectedSlotNotice, setSelectedSlotNotice] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [bookingCtaError, setBookingCtaError] = useState<string | null>(null);

  const shouldAutoStartChat = useMemo(() => {
    const v = (new URLSearchParams(search).get("startChat") ?? "").trim();
    return v === "1" || v.toLowerCase() === "true";
  }, [search]);

  useEffect(() => {
    if (!payError) return;
    if (selectedService || bookingStart || bookingEnd) {
      setPayError(null);
    }
  }, [bookingEnd, bookingStart, payError, selectedService]);

  useEffect(() => {
    if (!bookingCtaError) return;
    if (isLoaded && isSignedIn) {
      setBookingCtaError(null);
    }
  }, [bookingCtaError, isLoaded, isSignedIn]);

  async function continueToReservation() {
    if (maintenanceMode) {
      setBookingCtaError(maintenanceBookingUserMessage(adminNote));
      return;
    }
    const qp = new URLSearchParams();
    qp.set("service", serviceUi.current.label);
    if (slotsServiceType === "PENSION") {
      qp.set("start", boardingStart);
      qp.set("end", boardingEnd);
    } else {
      qp.set("date", slotsDate);
    }
    if (effectivePreviewMode) {
      qp.set("mode", "preview");
    }
    router.push(`/sitter/${encodeURIComponent(id)}/reservation?${qp.toString()}`);
  }

  async function pay() {
    if (paying) return;
    setPaying(true);
    setPayError(null);

    if (maintenanceMode) {
      setPayError(maintenanceBookingUserMessage(adminNote));
      setPaying(false);
      return;
    }

    const isHourlyService = selectedService === "Promenade" || selectedService === "Garde";
    const hasHourlyDates = Boolean(selectedSlot && selectedSlot.startAt && selectedSlot.endAt);
    const hasDailyDates = Boolean(bookingStart && bookingEnd);

    if (!selectedService) {
      setPayError("Choisissez un service et des dates avant de payer.");
      setPaying(false);
      return;
    }

    if (isHourlyService) {
      if (!hasHourlyDates) {
        setPayError("Choisissez un créneau avant de payer.");
        setPaying(false);
        return;
      }
    } else {
      if (!hasDailyDates) {
        setPayError("Choisissez un service et des dates avant de payer.");
        setPaying(false);
        return;
      }
    }

    try {
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sitterId: id,
          service: selectedService,
          startDate: isHourlyService ? undefined : bookingStart,
          endDate: isHourlyService ? undefined : bookingEnd,
          startAt: isHourlyService ? selectedSlot?.startAt : undefined,
          endAt: isHourlyService ? selectedSlot?.endAt : undefined,
          message: bookingMessage,
        }),
      });

      const bookingPayload = (await bookingRes.json()) as { ok?: boolean; bookingId?: string; error?: string; message?: string };
      const bookingId = typeof bookingPayload?.bookingId === "string" ? bookingPayload.bookingId : "";

      if (bookingRes.status === 503 || bookingPayload?.error === "MAINTENANCE") {
        setPayError(maintenanceBookingUserMessage(adminNote));
        return;
      }

      if (!bookingRes.ok || !bookingPayload?.ok || !bookingId) {
        setPayError("Impossible de démarrer la réservation. Réessayez.");
        return;
      }

      router.push(`/checkout/${encodeURIComponent(bookingId)}`);
    } catch {
      setPayError("Impossible de démarrer la réservation. Réessayez.");
    } finally {
      setPaying(false);
    }
  }

  const pricingRows = useMemo(() => {
    if (!sitter) return [] as { service: string; price: number | null }[];
    return sitter.services.map((svc) => {
      const v = (sitter.pricing as Record<string, number | undefined>)[svc];
      const price = typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
      return { service: svc, price };
    });
  }, [sitter]);

  const fromPricing = useMemo(() => {
    if (!sitter) return null as null | { price: number; unit: "/ jour" | "/ heure" };
    const candidates = sitter.services
      .map((svc) => ({ svc, price: (sitter.pricing as unknown as Record<string, unknown> | null)?.[svc] }))
      .filter((row) => typeof row.price === "number" && Number.isFinite(row.price) && row.price > 0) as Array<{
      svc: (typeof sitter.services)[number];
      price: number;
    }>;
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.price - b.price);
    const cheapest = candidates[0];
    return { price: cheapest.price, unit: cheapest.svc === "Pension" ? "/ jour" : "/ heure" };
  }, [sitter]);

  const boardingDetails = sitter?.boardingDetails ?? null;
  const servicesIncludePension = Array.isArray(sitter?.services) && sitter.services.includes("Pension");
  const showBoardingDetails =
    servicesIncludePension &&
    Boolean(
      boardingDetails &&
        (boardingDetails.housingType ||
          typeof boardingDetails.hasGarden === "boolean" ||
          typeof boardingDetails.hasOtherPets === "boolean" ||
          (typeof boardingDetails.notes === "string" && boardingDetails.notes.trim()) ||
          (Array.isArray(boardingDetails.pensionAcceptedSizes) && boardingDetails.pensionAcceptedSizes.length > 0))
    );

  const bookingDays = daysBetweenInclusive(bookingStart, bookingEnd);
  const bookingPriceUnit =
    selectedService && sitter?.pricing && selectedService in sitter.pricing
      ? (sitter.pricing as Record<string, number | undefined>)[selectedService] ?? null
      : null;
  const bookingEstimate = bookingPriceUnit
    ? selectedService === "Promenade"
      ? bookingPriceUnit
      : selectedService === "Garde"
        ? bookingPriceUnit
      : bookingPriceUnit * bookingDays
    : null;

  const isHostViewingOwnStable = hydrated && isHostViewingOwn;
  const showFullListing = !isHostViewingOwnStable || viewMode === "public" || effectivePreviewMode;
  const showHostChrome = effectivePreviewMode || (isHostViewingOwnStable && viewMode !== "public");
  const disableSelfActions = effectivePreviewMode || isHostViewingOwnStable;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const handler = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const inActions = Boolean(actionsRef.current && target && actionsRef.current.contains(target));
      if (inActions) {
        console.log("[sitter][submit][capture] prevented", {
          sitterId: id,
          target: target?.tagName,
          targetId: target?.id,
          targetClass: target?.className,
        });
        e.preventDefault();
        e.stopPropagation();
      } else {
        console.log("[sitter][submit][capture]", {
          sitterId: id,
          target: target?.tagName,
          targetId: target?.id,
          targetClass: target?.className,
        });
      }
    };
    document.addEventListener("submit", handler, true);
    return () => document.removeEventListener("submit", handler, true);
  }, [id]);

  useEffect(() => {
    if (!shouldAutoStartChat) return;
    if (!id) return;
    if (!isLoaded) return;
    if (!isSignedIn) return;
    if (disableSelfActions) return;
    if (startingChat) return;

    setStartingChat(true);
    setChatError(null);
    void (async () => {
      try {
        if (process.env.NODE_ENV !== "production") {
          console.log("[sitter][startChat] creating conversation", { sitterId: id });
        }
        const res = await fetch("/api/messages/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sitterId: id }),
        });
        const payload = (await res.json()) as { ok?: boolean; conversationId?: string; error?: string };
        const conversationId = typeof payload?.conversationId === "string" ? payload.conversationId : "";
        if (!res.ok || !payload.ok || !conversationId) {
          if (res.status === 401 || payload.error === "UNAUTHORIZED") {
            const next = `/sitter/${encodeURIComponent(id)}?mode=public&startChat=1`;
            router.push(`/login?next=${encodeURIComponent(next)}`);
            return;
          }
          setChatError(`Erreur serveur: ${payload.error ?? res.status}`);
          return;
        }

        const nextParams = new URLSearchParams(search);
        nextParams.delete("startChat");
        const tail = nextParams.toString();
        const keepOnUrl = tail ? `?${tail}` : "";
        router.replace(`/sitter/${encodeURIComponent(id)}${keepOnUrl}`);
        const target = `/account/messages/${encodeURIComponent(conversationId)}`;
        if (typeof window !== "undefined") {
          window.location.assign(target);
        } else {
          router.push(target);
        }
      } catch {
        setChatError("Erreur réseau. Réessaie.");
      } finally {
        setStartingChat(false);
      }
    })();
     
  }, [shouldAutoStartChat, id, isLoggedIn, disableSelfActions]);

  const hostUserValue = useMemo(
    () => makeHostUserValuePreview({ sitterId: currentHostId, profile: profileData }),
    [currentHostId, profileData]
  );

  const isHostPreview = showHostChrome && effectivePreviewMode;
  const canEvaluateFinalizeModal =
    isHostPreview &&
    previewLoaded &&
    hostProfileCompletionLoaded &&
    isHostViewingOwnStable &&
    typeof hostProfileCompletion === "number";
  const shouldShowFinalizeModal = canEvaluateFinalizeModal && hostProfileCompletion < 100;

  const [slotsServiceType, setSlotsServiceType] = useState<"PROMENADE" | "DOGSITTING" | "PENSION">("PROMENADE");
  const [slotsDate, setSlotsDate] = useState<string>("");
  const [boardingStart, setBoardingStart] = useState<string>("");
  const [boardingEnd, setBoardingEnd] = useState<string>("");
  const [pensionSelectionMessage, setPensionSelectionMessage] = useState<string | null>(null);
  const [boardingStatusLoading, setBoardingStatusLoading] = useState(false);
  const [boardingStatusError, setBoardingStatusError] = useState<string | null>(null);
  const [boardingStatusRetryKey, setBoardingStatusRetryKey] = useState(0);
  const [boardingStatus, setBoardingStatus] = useState<
    | {
        status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
        days: Array<{ date: string; status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; reason?: string }>;
        blockingDays?: Array<{ date: string; status: "UNAVAILABLE"; reason?: string }>;
      }
    | null
  >(null);
  const [daySlots, setDaySlots] = useState<
    Array<{ startAt: string; endAt: string; status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; reason?: string }>
  >([]);
  const [configuredRanges, setConfiguredRanges] = useState<
    Array<{ startAt: string; endAt: string; status: "AVAILABLE" | "ON_REQUEST" }>
  >([]);
  const [serviceSummary, setServiceSummary] = useState<
    | {
        minDurationMin: number;
        maxDurationMin: number;
        stepMin: number;
        leadTimeMin: number;
        bufferBeforeMin: number;
        bufferAfterMin: number;
        hasExplicitTimeSlots: boolean;
      }
    | null
  >(null);
  const [dogsittingDurationMin, setDogsittingDurationMin] = useState<number | null>(null);
  const [slotWhyOpenKey, setSlotWhyOpenKey] = useState<string | null>(null);
  const [calendarInfoDate, setCalendarInfoDate] = useState<string | null>(null);
  const [dayDetailsLoading, setDayDetailsLoading] = useState(false);
  const [dayDetailsError, setDayDetailsError] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<
    | null
    | {
        status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
        summary: { availableCount: number; onRequestCount: number; unavailableCount: number };
        buckets: Array<{ key: string; label: string; count: number }>;
        dbg?: { topReasons?: Array<{ reason: string; count: number }> };
      }
  >(null);
  const [dayDetailsRetryKey, setDayDetailsRetryKey] = useState(0);
  const [dayDetailsOpen, setDayDetailsOpen] = useState(false);
  const dayDetailsControllerRef = useRef<AbortController | null>(null);
  const [agendaExpandedGroups, setAgendaExpandedGroups] = useState<Record<string, boolean>>({});
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsRetryKey, setSlotsRetryKey] = useState(0);

  const [monthCursor, setMonthCursor] = useState(() => {
    const dt = new Date();
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 0, 0, 0, 0));
  });
  const [monthDays, setMonthDays] = useState<
    Array<{
      date: string;
      promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
      dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
      pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
      promenadePartial?: boolean;
      dogsittingPartial?: boolean;
      pensionPartial?: boolean;
    }>
  >([]);

  const [nextDays, setNextDays] = useState<
    Array<{
      date: string;
      promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
      dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
      pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
      promenadePartial?: boolean;
      dogsittingPartial?: boolean;
      pensionPartial?: boolean;
    }>
  >([]);
  const [nextDaysLoading, setNextDaysLoading] = useState(false);
  const [nextDaysError, setNextDaysError] = useState<string | null>(null);
  const [nextDaysRetryKey, setNextDaysRetryKey] = useState(0);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [monthRetryKey, setMonthRetryKey] = useState(0);
  const todayIso = useMemo(() => todayZurichIsoDate(), []);

  useEffect(() => {
    if (!canEvaluateFinalizeModal) {
      setFinalizeModalOpen(false);
      return;
    }
    if (hostProfileCompletion === 100) {
      setFinalizeModalOpen(false);
      return;
    }
    if (hostProfileCompletion < 100) {
      setFinalizeModalOpen(true);
      return;
    }
    setFinalizeModalOpen(false);
  }, [canEvaluateFinalizeModal, hostProfileCompletion]);

  useEffect(() => {
    if (!sitter?.services?.length) return;
    const availableSlotTypes = sitter.services.map((service) => serviceLabelToSlotsType(service));
    if (!availableSlotTypes.includes(slotsServiceType)) {
      setSlotsServiceType(availableSlotTypes[0]);
    }
  }, [sitter, slotsServiceType]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      setNextDaysLoading(true);
      setNextDaysError(null);
      try {
        const tz = "Europe/Zurich";
        const todayIso = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        const start = new Date(`${todayIso}T12:00:00Z`);
        const end = new Date(start.getTime() + 59 * 24 * 60 * 60 * 1000);
        const toIso = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(end);

        const qp = new URLSearchParams();
        qp.set("from", todayIso);
        qp.set("to", toIso);
        if (dbg) qp.set("dbg", "1");

        const res = await fetch(
          `/api/sitters/${encodeURIComponent(id)}/day-status/multi?${qp.toString()}`,
          { method: "GET", cache: "no-store", signal: controller.signal }
        );
        const payload = (await res.json().catch(() => null)) as any;
        if (cancelled) return;
        if (!res.ok || !payload?.ok || !Array.isArray(payload?.days)) {
          const err = payload?.error;
          setNextDaysError(typeof err === "string" ? err : "DAY_STATUS_ERROR");
          setNextDays([]);
          return;
        }

        const rows = payload.days.filter(
          (d: any): d is {
            date: string;
            promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
            dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
            pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
            promenadePartial?: boolean;
            dogsittingPartial?: boolean;
            pensionPartial?: boolean;
          } => d && typeof d.date === "string"
        );
        setNextDays(rows);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNextDaysError("DAY_STATUS_NETWORK_ERROR");
        setNextDays([]);
      } finally {
        if (cancelled) return;
        setNextDaysLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dbg, id, nextDaysRetryKey]);

  const nextAvail = useMemo(() => {
    const rows = Array.isArray(nextDays) ? nextDays : [];
    const candidates: string[] = [];
    for (const d of rows) {
      if (!d || typeof d.date !== "string") continue;
      const status = statusForSelectedService(d, slotsServiceType);
      const partial = partialForSelectedService(d, slotsServiceType);
      if (status === "AVAILABLE" || status === "ON_REQUEST" || partial) candidates.push(d.date);
    }
    candidates.sort();
    return candidates.slice(0, 3);
  }, [nextDays, slotsServiceType]);

  const serviceUi = useMemo(() => {
    const byKey = {
      PROMENADE: { icon: "🚶", label: "Promenade" },
      DOGSITTING: { icon: "🏠", label: "Dogsitting" },
      PENSION: { icon: "🛌", label: "Pension" },
    } as const;
    const current = byKey[slotsServiceType];

    const statusLabel = (s: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") =>
      s === "AVAILABLE" ? "Disponible" : s === "ON_REQUEST" ? "Sur demande" : "Indisponible";

    const statusLabelLong = (s: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") =>
      s === "AVAILABLE"
        ? "Disponible"
        : s === "ON_REQUEST"
          ? "Sur demande (réponse du sitter requise)"
          : "Indisponible";

    return { byKey, current, statusLabel, statusLabelLong };
  }, [slotsServiceType]);

  const userReasonBucket = useMemo(() => {
    const statusText = (s: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") =>
      s === "AVAILABLE" ? "Disponible" : s === "ON_REQUEST" ? "Sur demande" : "Indisponible";

    const bucketForReason = (reason?: string) => {
      const key = mapReasonToBucket(reason);
      return {
        key,
        title: BUCKET_LABELS_FR[key],
        detail: bucketDetailFr(key),
      };
    };

    return { statusText, bucketForReason };
  }, []);

  const bookingSelectionSummary = useMemo(() => {
    if (slotsServiceType === "PENSION") {
      if (!boardingStart) return null;
      if (!boardingEnd || boardingEnd === boardingStart) return `Séjour : ${formatDateFr(boardingStart)}`;
      return `Séjour : ${formatSelectionRange(boardingStart, boardingEnd)}`;
    }
    if (!slotsDate) return null;
    return `Date sélectionnée : ${formatDateFr(slotsDate)}`;
  }, [boardingEnd, boardingStart, slotsDate, slotsServiceType]);

  const canRequestBooking = useMemo(() => {
    if (disableSelfActions) return false;
    if (slotsServiceType === "PENSION") {
      if (!boardingStart) return false;
      if (boardingEnd && boardingEnd < boardingStart) return false;
      if (boardingStatusLoading) return false;
      if (boardingStatus?.status === "UNAVAILABLE") return false;
      return true;
    }
    return Boolean(slotsDate);
  }, [boardingEnd, boardingStart, boardingStatus?.status, boardingStatusLoading, disableSelfActions, slotsDate, slotsServiceType]);

  useEffect(() => {
    if (!id) return;
    if (!calendarInfoDate) {
      setDayDetails(null);
      setDayDetailsError(null);
      setDayDetailsLoading(false);
      setDayDetailsOpen(false);
      return;
    }
    if (!dayDetailsOpen) return;

    let cancelled = false;
    const controller = new AbortController();
    dayDetailsControllerRef.current?.abort();
    dayDetailsControllerRef.current = controller;

    const debounce = setTimeout(() => {
      void (async () => {
        setDayDetailsLoading(true);
        setDayDetailsError(null);
        try {
          const qp = new URLSearchParams();
          qp.set("date", calendarInfoDate);
          qp.set("service", slotsServiceType);
          if (slotsServiceType === "DOGSITTING" && typeof dogsittingDurationMin === "number" && Number.isFinite(dogsittingDurationMin)) {
            qp.set("durationMin", String(dogsittingDurationMin));
          }
          if (dbg) qp.set("dbg", "1");

          const res = await fetch(`/api/sitters/${encodeURIComponent(id)}/day-details?${qp.toString()}`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          });
          const payload = (await res.json().catch(() => null)) as
            | {
                ok: true;
                status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
                summary: { availableCount: number; onRequestCount: number; unavailableCount: number };
                buckets: Array<{ key: string; label: string; count: number }>;
                dbg?: { topReasons?: Array<{ reason: string; count: number }> };
              }
            | { ok: false; error: string }
            | null;

          if (cancelled) return;
          if (!res.ok || !payload || !payload.ok) {
            const err = (payload as any)?.error;
            setDayDetailsError(typeof err === "string" ? err : "DAY_DETAILS_ERROR");
            setDayDetails(null);
            return;
          }
          setDayDetails({
            status: payload.status,
            summary: payload.summary,
            buckets: Array.isArray(payload.buckets) ? payload.buckets : [],
            dbg: payload.dbg,
          });
        } catch (error) {
          if (cancelled) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setDayDetailsError("DAY_DETAILS_NETWORK_ERROR");
          setDayDetails(null);
        } finally {
          if (cancelled) return;
          setDayDetailsLoading(false);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
      controller.abort();
    };
  }, [calendarInfoDate, dayDetailsOpen, dayDetailsRetryKey, dbg, dogsittingDurationMin, id, slotsServiceType]);

  const monthMeta = useMemo(() => {
    const y = monthCursor.getUTCFullYear();
    const m = monthCursor.getUTCMonth();
    const first = new Date(Date.UTC(y, m, 1, 12, 0, 0, 0));
    const last = new Date(Date.UTC(y, m + 1, 0, 12, 0, 0, 0));

    const toZurichIso = (dt: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(dt);

    const fromIso = toZurichIso(first);
    const toIso = toZurichIso(last);

    const firstLocalDow = new Date(`${fromIso}T12:00:00Z`).getUTCDay();
    const mondayIndex = (firstLocalDow + 6) % 7;

    const monthLabel = new Intl.DateTimeFormat("fr-CH", {
      timeZone: "Europe/Zurich",
      month: "long",
      year: "numeric",
    }).format(first);

    const daysInMonth = Number(toIso.slice(8, 10));
    return { fromIso, toIso, mondayIndex, daysInMonth, monthLabel, year: y, month: m };
  }, [monthCursor]);

  const monthDaysByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
        dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
        pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
        promenadePartial?: boolean;
        dogsittingPartial?: boolean;
        pensionPartial?: boolean;
      }
    >();
    for (const row of monthDays) {
      if (!row || typeof row.date !== "string") continue;
      map.set(row.date, {
        promenadeStatus: row.promenadeStatus,
        dogsittingStatus: row.dogsittingStatus,
        pensionStatus: row.pensionStatus,
        promenadePartial: row.promenadePartial,
        dogsittingPartial: row.dogsittingPartial,
        pensionPartial: row.pensionPartial,
      });
    }
    return map;
  }, [monthDays]);

  const selectedDayStatus = useMemo(() => {
    if (!slotsDate) return null;
    return statusForSelectedService(monthDaysByDate.get(slotsDate), slotsServiceType);
  }, [monthDaysByDate, slotsDate, slotsServiceType]);

  const selectedDayPartial = useMemo(() => {
    if (!slotsDate) return false;
    return partialForSelectedService(monthDaysByDate.get(slotsDate), slotsServiceType);
  }, [monthDaysByDate, slotsDate, slotsServiceType]);

  const AvailabilityCalendar = ({
    monthMeta,
    monthLoading,
    monthError,
    monthDaysByDate,
    setMonthRetryKey,
    slotsServiceType,
    slotsDate,
    setSlotsDate,
    boardingStart,
    boardingEnd,
    setBoardingStart,
    setBoardingEnd,
    pensionSelectionMessage,
    setPensionSelectionMessage,
    bookingSelectionSummary,
    calendarInfoDate,
    setCalendarInfoDate,
    dayDetailsOpen,
    setDayDetailsOpen,
    dayDetailsLoading,
    dayDetailsError,
    dayDetails,
    setDayDetailsRetryKey,
    daySlots,
    daySlotsSummary,
    slotsLoading,
    slotsError,
    dbg,
    serviceUi,
    todayIso,
  }: any) => {
    return (
      <>
        {monthLoading ? (
          <div className="mt-3 grid gap-2" aria-label="Chargement du calendrier">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 21 }).map((_, i) => (
                <div key={`cal-skel-${i}`} className="h-14 w-full animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          </div>
        ) : monthError ? (
          <div className="mt-2">
            <p className="text-sm text-rose-700">{getAvailabilityLoadErrorMessage(monthError)}</p>
            <button
              type="button"
              onClick={() => setMonthRetryKey((v: number) => v + 1)}
              className="mt-2 inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <SharedCalendar
              variant="profile"
              mode={slotsServiceType === "PENSION" ? "range" : "single"}
              year={monthMeta.year}
              month={monthMeta.month}
              onMonthChange={(y: number, m: number) => setMonthCursor(new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)))}
              selectedStart={slotsServiceType === "PENSION" ? (boardingStart || null) : (slotsDate || null)}
              selectedEnd={slotsServiceType === "PENSION" ? (boardingEnd || null) : null}
              onDateSelect={(iso: string) => {
                setPensionSelectionMessage(null);
                if (slotsServiceType === "PENSION") {
                  if (boardingStart === iso && boardingEnd === iso) {
                    setBoardingStart("");
                    setBoardingEnd("");
                    setCalendarInfoDate(null);
                    setDayDetailsOpen(false);
                    return;
                  }
                  if (!boardingStart) {
                    setBoardingStart(iso);
                    setBoardingEnd(iso);
                    setCalendarInfoDate(iso);
                    setDayDetailsOpen(false);
                  } else {
                    if (boardingEnd && boardingEnd > boardingStart) {
                      if (iso <= boardingStart) {
                        setBoardingStart(iso);
                        setBoardingEnd(iso);
                        setCalendarInfoDate(iso);
                        setDayDetailsOpen(false);
                        return;
                      }
                      setBoardingEnd(iso);
                      setCalendarInfoDate(iso);
                      setDayDetailsOpen(false);
                      return;
                    }
                    if (iso < boardingStart) {
                      setBoardingStart(iso);
                      setBoardingEnd(iso);
                      setCalendarInfoDate(iso);
                      setDayDetailsOpen(false);
                      return;
                    }
                    if (iso === boardingStart) {
                      setBoardingStart("");
                      setBoardingEnd("");
                      setCalendarInfoDate(null);
                      setDayDetailsOpen(false);
                      return;
                    }
                    setBoardingEnd(iso);
                    setCalendarInfoDate(iso);
                    setDayDetailsOpen(false);
                  }
                  return;
                }
                if (slotsDate === iso) {
                  setSlotsDate("");
                  setCalendarInfoDate(null);
                  setDayDetailsOpen(false);
                  return;
                }
                setSlotsDate(iso);
                setCalendarInfoDate(iso);
                setDayDetailsOpen(false);
              }}
              availability={monthDaysByDate as Map<string, DayAvailability>}
              activeService={slotsServiceType}
            />

            {slotsServiceType !== "PENSION" && bookingSelectionSummary ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-900">{bookingSelectionSummary}</p>
              </div>
            ) : null}

            {slotsServiceType !== "PENSION" && slotsDate ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Créneaux disponibles</p>
                <p className="mt-1 text-sm text-slate-600">
                  {serviceUi.current.label} le {formatDateFr(slotsDate)}
                </p>

                {selectedSlotNotice ? <p className="mt-3 text-sm text-amber-900">{selectedSlotNotice}</p> : null}

                {slotsLoading ? (
                  <p className="mt-3 text-sm text-slate-600">Chargement des disponibilités…</p>
                ) : slotsError ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-sm text-rose-700">Impossible de charger les créneaux pour cette date.</p>
                  </div>
                ) : selectedDayStatus === "ON_REQUEST" ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">Sur demande</p>
                    <p className="mt-1 text-sm text-amber-800">Ce service est disponible uniquement sur demande pour cette date.</p>
                  </div>
                ) : selectedDayPartial ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">Disponibilité partielle</p>
                    <p className="mt-1 text-sm text-amber-800">Cette date reste réservable, mais certains créneaux sont déjà bloqués par une réservation existante.</p>
                  </div>
                ) : selectedDayStatus === "UNAVAILABLE" ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">Indisponible</p>
                  </div>
                ) : serviceSummary && !serviceSummary.hasExplicitTimeSlots && !dayHasBookingConflicts ? (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-sm font-semibold text-emerald-900">Disponible toute la journée</p>
                  </div>
                ) : serviceSummary && !serviceSummary.hasExplicitTimeSlots && dayHasBookingConflicts ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">Disponibilité partielle</p>
                    <p className="mt-1 text-sm text-amber-800">Une partie de la journée est déjà réservée.</p>
                  </div>
                ) : configuredRanges.length ? (
                  <div className="mt-3 grid gap-2">
                    {configuredRanges.map((range) => (
                      <div key={`${range.startAt}-${range.endAt}-${range.status}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <span className="text-sm font-medium text-slate-900">
                          {formatTimeLabel(range.startAt)} - {formatTimeLabel(range.endAt)}
                        </span>
                        {range.status === "ON_REQUEST" ? <span className="text-xs font-semibold text-amber-700">Sur demande</span> : null}
                      </div>
                    ))}
                  </div>
                ) : daySlotsSummary.length ? (
                  <div className="mt-3 grid gap-3">
                    {daySlotsSummary.map((group: any) => (
                      <div key={group.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{group.label}</p>
                        <div className="mt-2 grid gap-2">
                          {group.ranges.map((range: any) => (
                            <div key={`${range.startAt}-${range.endAt}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <span className="text-sm font-medium text-slate-900">
                                {formatTimeLabel(range.startAt)} - {formatTimeLabel(range.endAt)}
                              </span>
                              {range.hasOnRequest ? (
                                <span className="text-xs font-semibold text-amber-700">Sur demande</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm text-slate-600">Aucun créneau disponible n’est renseigné pour cette date.</p>
                  </div>
                )}
              </div>
            ) : null}

            {slotsServiceType === "PENSION" ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Sélection du séjour</p>
                <p className="mt-1 text-sm text-slate-600">
                  Choisissez une date pour un séjour d’un jour, puis cliquez sur une date plus tardive si vous souhaitez étendre le séjour.
                </p>
                {bookingSelectionSummary ? <p className="mt-3 text-sm font-medium text-slate-900">{bookingSelectionSummary}</p> : null}
                {pensionSelectionMessage ? <p className="mt-2 text-sm font-medium text-amber-900">{pensionSelectionMessage}</p> : null}
              </div>
            ) : null}
          </div>
        )}
      </>
    );
  };

  const daySlotsAgenda = useMemo(() => {
    const parseHour = (iso: string) => {
      const h = Number(iso.slice(11, 13));
      return Number.isFinite(h) ? h : 0;
    };

    const groups: Array<{ key: "MORNING" | "AFTERNOON" | "EVENING"; label: string; items: typeof daySlots }> = [
      { key: "MORNING", label: "Matin", items: [] },
      { key: "AFTERNOON", label: "Après-midi", items: [] },
      { key: "EVENING", label: "Soir", items: [] },
    ];

    for (const slot of daySlots) {
      const h = parseHour(slot.startAt);
      if (h < 12) groups[0].items.push(slot);
      else if (h < 18) groups[1].items.push(slot);
      else groups[2].items.push(slot);
    }

    return groups.filter((g) => g.items.length);
  }, [daySlots]);

  const daySlotsSummary = useMemo(() => {
    const sourceRanges = configuredRanges.length
      ? configuredRanges.map((range) => ({
          startAt: range.startAt,
          endAt: range.endAt,
          hasOnRequest: range.status === "ON_REQUEST",
        }))
      : [];

    if (sourceRanges.length) {
      const groups = new Map<string, { key: string; label: string; ranges: typeof sourceRanges }>();
      for (const range of sourceRanges) {
        const hour = Number(range.startAt.slice(11, 13));
        const key = hour < 12 ? "MORNING" : hour < 18 ? "AFTERNOON" : "EVENING";
        const label = key === "MORNING" ? "Matin" : key === "AFTERNOON" ? "Après-midi" : "Soir";
        const existing = groups.get(key);
        if (existing) {
          existing.ranges.push(range);
        } else {
          groups.set(key, { key, label, ranges: [range] });
        }
      }
      return Array.from(groups.values());
    }

    const mergeRanges = (items: typeof daySlots) => {
      const eligible = items
        .filter((slot) => slot.status === "AVAILABLE" || slot.status === "ON_REQUEST")
        .slice()
        .sort((a, b) => a.startAt.localeCompare(b.startAt));

      const ranges: Array<{ startAt: string; endAt: string; hasOnRequest: boolean }> = [];
      for (const slot of eligible) {
        const prev = ranges[ranges.length - 1];
        if (prev && prev.endAt === slot.startAt) {
          prev.endAt = slot.endAt;
          prev.hasOnRequest = prev.hasOnRequest || slot.status === "ON_REQUEST";
          continue;
        }
        ranges.push({
          startAt: slot.startAt,
          endAt: slot.endAt,
          hasOnRequest: slot.status === "ON_REQUEST",
        });
      }
      return ranges;
    };

    return daySlotsAgenda
      .map((group) => ({
        key: group.key,
        label: group.label,
        ranges: mergeRanges(group.items),
      }))
      .filter((group) => group.ranges.length);
  }, [configuredRanges, daySlots, daySlotsAgenda]);

  const dayHasBookingConflicts = useMemo(() => {
    return daySlots.some(
      (slot) =>
        slot.status === "UNAVAILABLE" &&
        (slot.reason === "booking_paid_overlap" ||
          slot.reason === "booking_confirmed_overlap" ||
          slot.reason === "booking_pending_payment_overlap" ||
          slot.reason === "booking_pending_acceptance_overlap")
    );
  }, [daySlots]);

  const dogsittingDurationOptions = useMemo(() => {
    if (slotsServiceType !== "DOGSITTING") return [] as number[];
    if (!serviceSummary) return [] as number[];

    const min = Math.max(1, Math.round(serviceSummary.minDurationMin));
    const step = Math.max(1, Math.round(serviceSummary.stepMin));
    const maxCfg = Math.max(0, Math.round(serviceSummary.maxDurationMin));
    const cap = maxCfg > 0 ? maxCfg : 240;
    const max = Math.max(min, cap);

    const out: number[] = [];
    for (let d = min; d <= max; d += step) out.push(d);
    return out.slice(0, 30);
  }, [serviceSummary, slotsServiceType]);

  useEffect(() => {
    setSelectedSlot(null);
    setSelectedSlotNotice(null);
  }, [slotsDate, slotsServiceType]);

  useEffect(() => {
    if (slotsServiceType !== "DOGSITTING") {
      if (dogsittingDurationMin !== null) setDogsittingDurationMin(null);
      return;
    }
    if (!serviceSummary) return;
    const min = Math.max(1, Math.round(serviceSummary.minDurationMin));
    const step = Math.max(1, Math.round(serviceSummary.stepMin));
    const maxCfg = Math.max(0, Math.round(serviceSummary.maxDurationMin));
    const cap = maxCfg > 0 ? maxCfg : 240;

    const cur = dogsittingDurationMin;
    if (cur === null) {
      setDogsittingDurationMin(min);
      return;
    }
    if (cur < min) {
      setDogsittingDurationMin(min);
      return;
    }
    if (cur % step !== 0) {
      setDogsittingDurationMin(min);
      return;
    }
    if (maxCfg > 0 && cur > maxCfg) {
      setDogsittingDurationMin(maxCfg);
      return;
    }
    if (maxCfg <= 0 && cur > cap) {
      setDogsittingDurationMin(cap);
      return;
    }
  }, [dogsittingDurationMin, serviceSummary, slotsServiceType]);

  useEffect(() => {
    if (slotsServiceType !== "DOGSITTING") return;
    setSelectedSlot(null);
    setSelectedSlotNotice(null);
  }, [dogsittingDurationMin, slotsServiceType]);

  useEffect(() => {
    if (!selectedSlot) return;
    if (slotsServiceType === "PENSION") {
      setSelectedSlot(null);
      return;
    }
    if (slotsServiceType !== selectedSlot.serviceType) {
      setSelectedSlot(null);
      return;
    }
    if (slotsDate !== selectedSlot.dateIso) {
      setSelectedSlot(null);
      return;
    }
    if (slotsLoading) return;
    if (slotsError) {
      setSelectedSlot(null);
      setSelectedSlotNotice("Créneau mis à jour.");
      return;
    }
    const match = daySlots.find((s) => s.startAt === selectedSlot.startAt && s.endAt === selectedSlot.endAt);
    if (!match || match.status === "UNAVAILABLE" || match.status !== selectedSlot.status) {
      setSelectedSlot(null);
      setSelectedSlotNotice("Créneau mis à jour.");
    }
  }, [daySlots, selectedSlot, slotsDate, slotsError, slotsLoading, slotsServiceType]);

  useEffect(() => {
    if (!id) return;
    if (slotsServiceType !== "PENSION") {
      setBoardingStatus(null);
      setBoardingStatusError(null);
      setBoardingStatusLoading(false);
      return;
    }
    if (!boardingStart || !boardingEnd) {
      setBoardingStatus(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const debounce = setTimeout(() => {
      void (async () => {
        setBoardingStatusLoading(true);
        setBoardingStatusError(null);
        try {
          const qp = new URLSearchParams();
          qp.set("start", boardingStart);
          qp.set("end", boardingEnd);
          if (dbg) qp.set("dbg", "1");
          const res = await fetch(`/api/sitters/${encodeURIComponent(id)}/boarding-status?${qp.toString()}`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          });
          const payload = (await res.json().catch(() => null)) as
            | {
                ok: true;
                status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
                days: Array<{ date: string; status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; reason?: string }>;
                blockingDays?: Array<{ date: string; status: "UNAVAILABLE"; reason?: string }>;
              }
            | { ok: false; error: string }
            | null;
          if (cancelled) return;
          if (!res.ok || !payload || !payload.ok) {
            const err = (payload as any)?.error;
            setBoardingStatusError(typeof err === "string" ? err : "BOARDING_STATUS_ERROR");
            setBoardingStatus(null);
            return;
          }
          setBoardingStatus({
            status: payload.status,
            days: Array.isArray(payload.days) ? payload.days : [],
            blockingDays: Array.isArray(payload.blockingDays) ? payload.blockingDays : undefined,
          });
        } catch (error) {
          if (cancelled) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setBoardingStatusError("BOARDING_STATUS_NETWORK_ERROR");
          setBoardingStatus(null);
        } finally {
          if (cancelled) return;
          setBoardingStatusLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
      controller.abort();
    };
  }, [boardingEnd, boardingStart, boardingStatusRetryKey, dbg, id, slotsServiceType]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const controller = new AbortController();
    const debounce = setTimeout(() => {
      void (async () => {
        setMonthLoading(true);
        setMonthError(null);
        try {
          const qp = new URLSearchParams();
          qp.set("from", monthMeta.fromIso);
          qp.set("to", monthMeta.toIso);
          if (dbg) qp.set("dbg", "1");

          const res = await fetch(`/api/sitters/${encodeURIComponent(id)}/day-status/multi?${qp.toString()}`,
            {
              method: "GET",
              cache: "no-store",
              signal: controller.signal,
            });

          const payload = (await res.json().catch(() => null)) as
            | {
                ok: true;
                days: Array<{
                  date: string;
                  promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
                  dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
                  pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
                }>;
              }
            | { ok: false; error: string }
            | null;

          if (cancelled) return;
          if (!res.ok || !payload || !payload.ok || !Array.isArray((payload as any).days)) {
            const err = (payload as any)?.error;
            setMonthError(typeof err === "string" ? err : "DAY_STATUS_ERROR");
            setMonthDays([]);
            return;
          }

          const rows = payload.days.filter(
            (d): d is {
              date: string;
              promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
              dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
              pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
              promenadePartial?: boolean;
              dogsittingPartial?: boolean;
              pensionPartial?: boolean;
            } =>
              Boolean(
                d &&
                  typeof d.date === "string" &&
                  (d.promenadeStatus === "AVAILABLE" || d.promenadeStatus === "ON_REQUEST" || d.promenadeStatus === "UNAVAILABLE") &&
                  (d.dogsittingStatus === "AVAILABLE" || d.dogsittingStatus === "ON_REQUEST" || d.dogsittingStatus === "UNAVAILABLE") &&
                  (d.pensionStatus === "AVAILABLE" || d.pensionStatus === "ON_REQUEST" || d.pensionStatus === "UNAVAILABLE")
              )
          );
          setMonthDays(rows);
        } catch (error) {
          if (cancelled) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setMonthError("DAY_STATUS_NETWORK_ERROR");
          setMonthDays([]);
        } finally {
          if (cancelled) return;
          setMonthLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      controller.abort();
    };
  }, [dbg, id, monthMeta.fromIso, monthMeta.toIso, monthRetryKey, slotsServiceType]);

  useEffect(() => {
    if (!id || !slotsDate) return;
    let cancelled = false;
    const controller = new AbortController();
    const debounce = setTimeout(() => {
      void (async () => {
        setSlotsLoading(true);
        setSlotsError(null);
        try {
          const qp = new URLSearchParams();
          qp.set("date", slotsDate);
          qp.set("service", slotsServiceType);
          if (slotsServiceType === "DOGSITTING" && typeof dogsittingDurationMin === "number" && Number.isFinite(dogsittingDurationMin)) {
            qp.set("durationMin", String(dogsittingDurationMin));
          }
          if (dbg) qp.set("dbg", "1");
          const res = await fetch(`/api/sitters/${encodeURIComponent(id)}/slots?${qp.toString()}`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          });
          const payload = (await res.json().catch(() => null)) as
            | {
                ok: true;
                config?: {
                  minDurationMin?: number;
                  maxDurationMin?: number;
                  stepMin?: number;
                  leadTimeMin?: number;
                  bufferBeforeMin?: number;
                  bufferAfterMin?: number;
                  hasExplicitTimeSlots?: boolean;
                };
                durationMin?: number;
                configuredRanges?: Array<{ startAt: string; endAt: string; status: "AVAILABLE" | "ON_REQUEST" }>;
                slots: Array<{ startAt: string; endAt: string; status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; reason?: string }>;
              }
            | { ok: false; error: string }
            | null;
          if (cancelled) return;
          if (!res.ok || !payload || !payload.ok || !Array.isArray((payload as any).slots)) {
            const err = (payload as any)?.error;
            setSlotsError(typeof err === "string" ? err : "SLOTS_ERROR");
            setDaySlots([]);
            setConfiguredRanges([]);
            setServiceSummary(null);
            return;
          }

          const cfg = (payload as any)?.config;
          if (cfg && typeof cfg === "object") {
            setServiceSummary({
              minDurationMin: typeof cfg.minDurationMin === "number" ? cfg.minDurationMin : 0,
              maxDurationMin: typeof (cfg as any).maxDurationMin === "number" ? (cfg as any).maxDurationMin : 0,
              stepMin: typeof cfg.stepMin === "number" ? cfg.stepMin : 0,
              leadTimeMin: typeof cfg.leadTimeMin === "number" ? cfg.leadTimeMin : 0,
              bufferBeforeMin: typeof cfg.bufferBeforeMin === "number" ? cfg.bufferBeforeMin : 0,
              bufferAfterMin: typeof cfg.bufferAfterMin === "number" ? cfg.bufferAfterMin : 0,
              hasExplicitTimeSlots: Boolean((cfg as any).hasExplicitTimeSlots),
            });
          } else {
            setServiceSummary(null);
          }

          if (slotsServiceType === "DOGSITTING") {
            const effectiveDuration = typeof (payload as any).durationMin === "number" ? (payload as any).durationMin : null;
            if (effectiveDuration && Number.isFinite(effectiveDuration) && effectiveDuration > 0) {
              setDogsittingDurationMin(effectiveDuration);
            }
            if (dbg) {
              console.log("[ProfileContent][slots]", {
                sitterId: id,
                serviceType: slotsServiceType,
                date: slotsDate,
                durationMin: effectiveDuration,
                slots: Array.isArray((payload as any).slots) ? (payload as any).slots.length : null,
              });
            }
          }

          const slots = payload.slots.filter(
            (s): s is { startAt: string; endAt: string; status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; reason?: string } =>
              Boolean(s && typeof s.startAt === "string" && typeof s.endAt === "string" && typeof (s as any).status === "string")
          );
          const exactRanges = Array.isArray((payload as any).configuredRanges)
            ? (payload as any).configuredRanges.filter(
                (range: any): range is { startAt: string; endAt: string; status: "AVAILABLE" | "ON_REQUEST" } =>
                  Boolean(
                    range &&
                      typeof range.startAt === "string" &&
                      typeof range.endAt === "string" &&
                      (range.status === "AVAILABLE" || range.status === "ON_REQUEST")
                  )
              )
            : [];
          setDaySlots(slots);
          setConfiguredRanges(exactRanges);
        } catch (error) {
          if (cancelled) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (dbg) console.log("[ProfileContent] fetch error", error);
          setSlotsError("SLOTS_NETWORK_ERROR");
          setDaySlots([]);
          setConfiguredRanges([]);
          setServiceSummary(null);
        } finally {
          if (cancelled) return;
          setSlotsLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      controller.abort();
    };
  }, [dbg, id, slotsDate, slotsRetryKey, slotsServiceType]);

  if (process.env.NODE_ENV !== "production") {
    console.log("[sitter][render]", {
      sitterId: id,
      viewerDbUserId: null,
      viewerClerkUserId: user?.id ?? null,
      disableSelfActions,
      isLoaded,
      isSignedIn,
      mode: viewMode,
      pathname,
      search: search ? `?${search}` : "",
    });
  }

  const isLoading = sitter === undefined;

  if (isLoading) {
    if (dbg) console.log("[ProfileContent] returning loader - profile is", sitter);
    return <AccountPageSkeleton />;
  }

  if (dbg) console.log("[ProfileContent] render complete");

  if (sitter === null) {
    const isNotPublished = apiError === "NOT_PUBLISHED";
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)]">
            <h1 className="text-xl font-semibold text-slate-900">Sitter introuvable</h1>
            {isNotPublished ? (
              <p className="mt-2 text-sm text-slate-600">Profil existant mais non publié (dev).</p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Ce profil n&apos;est pas disponible.</p>
            )}
            <div className="mt-6">
              {isNotPublished ? (
                <Link
                  href="/host/profile/edit"
                  className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                >
                  Publier mon annonce
                </Link>
              ) : (
                <Link
                  href="/search"
                  className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                >
                  Voir les sitters
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const ratingLabel = formatRatingMaybe(sitter.rating);
  const reviewCountLabel = sitter.reviewCount ?? 0;
  const visibleReviews = Array.isArray(sitter.reviews) ? sitter.reviews : [];
  const dbgDogSizesParam = new URLSearchParams(search).get("dbgDogSizes") === "1";
  const dogSizeBadges =
    process.env.NODE_ENV !== "production" && dbgDogSizesParam ? ["Petit", "Moyen", "Grand"] : sitter.dogSizes;

  const content = (
    <div className="relative grid gap-4 overflow-hidden" data-testid="sitter-public-profile">
      <div className="relative z-10">
        {canEvaluateFinalizeModal ? (
          <Modal
            title="Finalisez votre profil"
            open={finalizeModalOpen}
            onClose={() => {
              if (finalizeLoading) return;
              setFinalizeModalOpen(false);
            }}
          >
            <p className="text-sm leading-relaxed text-slate-600">Complétez votre profil à 100% pour pouvoir publier votre annonce.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (finalizeLoading) return;
                  setFinalizeLoading(true);
                  router.push("/host/profile/edit");
                }}
                disabled={finalizeLoading}
                className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {finalizeLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    Chargement…
                  </span>
                ) : (
                  "Compléter mon profil"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (finalizeLoading) return;
                  setFinalizeModalOpen(false);
                }}
                disabled={finalizeLoading}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Plus tard
              </button>
            </div>
          </Modal>
        ) : null}

        {showHostChrome ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm font-semibold text-slate-600">Tableau de bord</p>
              <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                <User className="h-6 w-6 text-slate-700" aria-hidden="true" />
                <span>Profil public</span>
              </h1>
              <div className="mt-3 flex min-h-[32px] items-center" />
            </div>
          </div>
        ) : null}

        {showFullListing ? (
          <>
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <div>
                  {/* Hero */}
                  <div className="flex items-center gap-4 sm:gap-5">
                    <button
                      type="button"
                      onClick={() => setPhotoLightboxOpen(true)}
                      className="shrink-0 cursor-zoom-in focus:outline-none"
                      aria-label="Voir la photo en grand"
                    >
                      <img
                        src={sitter.avatarUrl}
                        alt={sitter.name}
                        className="h-20 w-20 sm:h-24 sm:w-24 lg:h-28 lg:w-28 rounded-full object-cover ring-1 ring-slate-200 transition-opacity hover:opacity-90"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                    <div className="min-w-0">
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">{sitter.name}</h1>
                      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
                        <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                        <span>{sitter.city}, {sitter.postalCode}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {reviewCountLabel === 0 ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            Nouveau sur DogShift
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-900">
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                            {ratingLabel} <span className="text-slate-500 underline decoration-slate-300 underline-offset-2">({reviewCountLabel} avis)</span>
                          </span>
                        )}
                        {sitter.verified ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                            Vérifié
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Mobile-only price band */}
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm lg:hidden">
                    <div className="flex items-baseline gap-1.5 text-slate-900">
                      <span className="text-xs font-medium text-slate-500">À partir de</span>
                      <span className="text-lg font-bold">CHF</span>
                      <span className="text-2xl font-extrabold tracking-tight">{fromPricing?.price ?? sitter.pricePerDay}</span>
                      <span className="text-sm font-medium text-slate-500">
                        {fromPricing?.unit ??
                          (typeof (sitter.pricing as unknown as Record<string, unknown> | null)?.Pension === "number" ? " / jour" : " / heure")}
                      </span>
                    </div>
                  </div>
                  
                  {/* Characteristics chips */}
                  <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-slate-100 py-4">
                    {dogSizeBadges.map((size) => {
                      const maxForSize = sitter.maxDogsBySize?.[size];
                      return (
                        <span key={size} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm">
                          <Dog className="h-4 w-4 text-slate-500" />
                          {size}
                          {maxForSize && maxForSize > 0 ? ` (max. ${maxForSize})` : ""}
                        </span>
                      );
                    })}
                    {dogSizeBadges.length > 0 && (sitter.acceptanceCriteria?.neuteredRequired || sitter.acceptanceCriteria?.maxDogs) ? (
                      <div className="hidden h-5 w-px bg-slate-200 sm:block" />
                    ) : null}
                    {sitter.acceptanceCriteria?.neuteredRequired && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm">
                        <Scissors className="h-4 w-4 text-slate-500" />
                        Castré/stérilisé requis
                      </span>
                    )}
                    {sitter.acceptanceCriteria?.maxDogs ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm">
                        <Users className="h-4 w-4 text-slate-500" />
                        Max. {sitter.acceptanceCriteria.maxDogs} chien{sitter.acceptanceCriteria.maxDogs > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-8">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">Services & tarifs</h2>
                  {sitter.services.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">Ce sitter n&apos;a pas encore renseigné ses services.</p>
                  ) : (
                    <div className="mt-3 divide-y divide-slate-100">
                      {pricingRows.map((row) => {
                        const hasPrice = typeof row.price === "number" && Number.isFinite(row.price) && row.price > 0;
                        const slotServiceType = serviceLabelToSlotsType(row.service);
                        const color = getServiceColors(slotServiceType);
                        const selected = slotsServiceType === slotServiceType;
                        return (
                          <button
                            key={row.service}
                            type="button"
                            role="tab"
                            aria-checked={selected}
                            onClick={() => setSlotsServiceType(slotServiceType)}
                            className={[
                              "flex w-full items-center justify-between py-3.5 text-left text-sm font-medium transition-colors",
                              selected ? "text-slate-900" : "text-slate-600 hover:text-slate-900",
                            ].join(" ")}
                          >
                            <span className="flex items-center gap-3">
                              <span className={`h-2.5 w-2.5 rounded-full ${selected ? color.fill : "bg-slate-300"}`} aria-hidden="true" />
                              <span className={selected ? "font-semibold" : ""}>{row.service}</span>
                            </span>
                            <span className={selected ? "font-bold text-slate-900" : "text-slate-500"}>
                              {hasPrice ? (
                                <>CHF {row.price} <span className="font-normal text-slate-400">{row.service === "Pension" ? "/ jour" : "/ heure"}</span></>
                              ) : "Sur demande"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">Agenda des disponibilités</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {slotsServiceType === "PENSION"
                      ? "Sélectionne une date de début puis une date de fin."
                      : "Sélectionne une date pour voir les créneaux disponibles."}
                  </p>

                  <div className="mt-5">
                    <AvailabilityCalendar
                      monthMeta={monthMeta}
                      monthLoading={monthLoading}
                      monthError={monthError}
                      monthDaysByDate={monthDaysByDate}
                      setMonthRetryKey={setMonthRetryKey}
                      slotsServiceType={slotsServiceType}
                      slotsDate={slotsDate}
                      setSlotsDate={setSlotsDate}
                      boardingStart={boardingStart}
                      boardingEnd={boardingEnd}
                      setBoardingStart={setBoardingStart}
                      setBoardingEnd={setBoardingEnd}
                      pensionSelectionMessage={pensionSelectionMessage}
                      setPensionSelectionMessage={setPensionSelectionMessage}
                      bookingSelectionSummary={bookingSelectionSummary}
                      calendarInfoDate={calendarInfoDate}
                      setCalendarInfoDate={setCalendarInfoDate}
                      dayDetailsOpen={dayDetailsOpen}
                      setDayDetailsOpen={setDayDetailsOpen}
                      dayDetailsLoading={dayDetailsLoading}
                      dayDetailsError={dayDetailsError}
                      dayDetails={dayDetails}
                      setDayDetailsRetryKey={setDayDetailsRetryKey}
                      daySlots={daySlots}
                      daySlotsSummary={daySlotsSummary}
                      slotsLoading={slotsLoading}
                      slotsError={slotsError}
                      dbg={dbg}
                      serviceUi={serviceUi}
                      todayIso={todayIso}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${getServiceColors("PROMENADE").fill}`} /><span>Promenade</span></div>
                    <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${getServiceColors("DOGSITTING").fill}`} /><span>Dogsitting</span></div>
                    <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${getServiceColors("PENSION").fill}`} /><span>Pension</span></div>
                  </div>

                  {bookingSelectionSummary ? (
                    <p className="mt-3 text-sm font-medium text-slate-900">{bookingSelectionSummary}</p>
                  ) : null}
                  {pensionSelectionMessage ? (
                    <p className="mt-1 text-sm font-medium text-amber-900">{pensionSelectionMessage}</p>
                  ) : null}
                </div>

                <div className="mt-8">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">Prochaines disponibilités</h2>
                  {nextDaysLoading ? (
                    <p className="mt-2 text-sm text-slate-500">Chargement…</p>
                  ) : nextDaysError ? (
                    <div className="mt-2">
                      <p className="text-sm text-rose-700">{getAvailabilityLoadErrorMessage(nextDaysError)}</p>
                      <button type="button" onClick={() => setNextDaysRetryKey((v) => v + 1)} className="mt-2 inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Réessayer</button>
                    </div>
                  ) : nextAvail.length ? (
                    <ul className="mt-3 grid gap-2">
                      {nextAvail.map((d) => (
                        <li key={d} className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                          <span className={`h-2 w-2 rounded-full ${getServiceColors(slotsServiceType).fill}`} />
                          <span>{formatDateFr(d)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm leading-relaxed text-slate-600">
                        Aucune disponibilité publiée pour le moment. Contacte {sitter.name.split(" ")[0]} pour proposer tes dates — il/elle répond généralement sous 24h.
                      </p>
                      <button type="button" onClick={() => { if (disableSelfActions) return; actionsRef.current?.querySelector<HTMLButtonElement>('button[data-chat="1"]')?.click(); }} className="mt-2 text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500 transition-colors">Envoyer un message</button>
                    </div>
                  )}
                </div>

                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">À propos de {sitter.name.split(" ")[0]}</h2>
                  {sitter.bio && sitter.bio.trim().length >= 20 ? (
                    <div className="mt-3">
                      <p className={`text-[15px] leading-relaxed text-slate-700 whitespace-pre-line ${!bioExpanded && sitter.bio.trim().length > 200 ? "line-clamp-4" : ""}`}>
                        {sitter.bio}
                      </p>
                      {sitter.bio.trim().length > 200 && !bioExpanded && (
                        <button
                          type="button"
                          onClick={() => setBioExpanded(true)}
                          className="mt-1.5 text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500 transition-colors"
                        >
                          Lire la suite
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-slate-500 italic">Ce sitter n&apos;a pas encore complété sa présentation.</p>
                  )}
                </div>

                {showBoardingDetails && boardingDetails ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">Détails pension</h2>
                    <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      {boardingDetails.housingType ? (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Logement</dt>
                          <dd className="mt-1.5 text-[15px] text-slate-900 font-medium">{boardingDetails.housingType}</dd>
                        </div>
                      ) : null}
                      {typeof boardingDetails.hasGarden === "boolean" ? (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Jardin</dt>
                          <dd className="mt-1.5 text-[15px] text-slate-900 font-medium">{boardingDetails.hasGarden ? "Oui" : "Non"}</dd>
                        </div>
                      ) : null}
                      {typeof boardingDetails.hasOtherPets === "boolean" ? (
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Autres animaux</dt>
                          <dd className="mt-1.5 text-[15px] text-slate-900 font-medium">{boardingDetails.hasOtherPets ? "Oui" : "Non"}</dd>
                        </div>
                      ) : null}
                      {boardingDetails.notes ? (
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</dt>
                          <dd className="mt-1.5 text-[15px] leading-relaxed text-slate-700 whitespace-pre-line">{boardingDetails.notes}</dd>
                        </div>
                      ) : null}
                      {Array.isArray(boardingDetails.pensionAcceptedSizes) && boardingDetails.pensionAcceptedSizes.length > 0 ? (
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tailles de chiens acceptées en pension</dt>
                          <dd className="mt-3 grid grid-cols-3 gap-2">
                            {(["small", "medium", "large"] as const).map((key) => {
                              const accepted = boardingDetails.pensionAcceptedSizes!.includes(key);
                              const labels: Record<string, { label: string; range: string }> = {
                                small: { label: "Petit", range: "< 10 kg" },
                                medium: { label: "Moyen", range: "10–25 kg" },
                                large: { label: "Grand", range: "> 25 kg" },
                              };
                              const { label, range } = labels[key];
                              return (
                                <div
                                  key={key}
                                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-3 text-center transition ${
                                    accepted
                                      ? "border-emerald-200 bg-emerald-50"
                                      : "border-slate-100 bg-slate-50 opacity-40"
                                  }`}
                                >
                                  <svg className={`h-5 w-5 ${accepted ? "text-emerald-600" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.344-2.5M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75z"/>
                                    <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306"/>
                                  </svg>
                                  <span className={`text-xs font-bold ${accepted ? "text-emerald-800" : "text-slate-400"}`}>{label}</span>
                                  <span className={`text-[10px] ${accepted ? "text-emerald-600" : "text-slate-400"}`}>{range}</span>
                                  {accepted ? (
                                    <span className="mt-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Accepté</span>
                                  ) : (
                                    <span className="mt-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400 line-through">Refusé</span>
                                  )}
                                </div>
                              );
                            })}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">Avis</h2>
                    {visibleReviews.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                          <span className="text-lg font-bold">{ratingLabel}</span>
                        </span>
                        <span className="text-sm font-medium text-slate-500">({reviewCountLabel} avis)</span>
                      </div>
                    )}
                  </div>
                  {visibleReviews.length === 0 ? (
                    <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
                      <MessageSquare className="h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-semibold text-slate-700">Aucun avis pour le moment</p>
                      <p className="mt-1 text-sm text-slate-500">Sois le premier à laisser un retour après ta réservation.</p>
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-4">
                      {visibleReviews.map((review) => (
                        <article key={review.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{review.authorName}</p>
                              <p className="mt-0.5 text-xs font-medium text-slate-500">{formatReviewDate(review.createdAt)}</p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {formatRating(review.rating)}
                            </span>
                          </div>
                          <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
                            {review.comment?.trim() ? review.comment.trim() : <span className="italic text-slate-500">Aucun commentaire ajouté.</span>}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-24">
                  <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm mb-4">
                    <p className="text-xs font-medium text-slate-500">À partir de</p>
                    <div className="mt-0.5 flex items-baseline gap-1.5 text-slate-900">
                      <span className="text-lg font-bold">CHF</span>
                      <span className="text-2xl font-extrabold tracking-tight">{fromPricing?.price ?? sitter.pricePerDay}</span>
                      <span className="text-sm font-medium text-slate-500">
                        {fromPricing?.unit ?? (typeof (sitter.pricing as unknown as Record<string, unknown> | null)?.Pension === "number" ? " / jour" : " / heure")}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div
                      ref={actionsRef}
                      onClickCapture={(e) => {
                        if (process.env.NODE_ENV === "production") return;
                        const t = e.target as HTMLElement | null;
                        const ct = e.currentTarget as HTMLElement | null;
                        console.log("[sitter][actions][capture]", { sitterId: id, disableSelfActions, target: t?.tagName, targetId: t?.id, targetClass: t?.className, currentTarget: ct?.tagName, currentTargetId: ct?.id, currentTargetClass: ct?.className });
                      }}
                    >
                      {disableSelfActions ? (
                        <div className="rounded-xl bg-slate-50 p-4 text-center">
                          <p className="text-sm font-medium text-slate-600">C&apos;est ton profil public. Voici ce que voient tes clients.</p>
                        </div>
                      ) : (
                        <>
                          <Tooltip label={!canRequestBooking ? "Sélectionne une date pour activer la réservation" : ""}>
                            {({ triggerProps }) => (
                              <button
                                {...triggerProps}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (maintenanceMode) { setBookingCtaError(maintenanceBookingUserMessage(adminNote)); return; }
                                  if (!isLoaded) { setBookingCtaError("Chargement de la session… Réessaie dans une seconde."); return; }
                                  if (!isSignedIn) { setBookingCtaError("Veuillez vous connecter pour demander une réservation."); return; }
                                  if (!canRequestBooking) {
                                    setBookingCtaError(slotsServiceType === "PENSION" ? "Sélectionnez une arrivée et une date de départ valides pour continuer." : "Sélectionnez un service et une date dans l'agenda pour continuer.");
                                    return;
                                  }
                                  setBookingCtaError(null);
                                  void continueToReservation();
                                }}
                                disabled={!canRequestBooking || maintenanceMode}
                                className="mb-3 flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition-colors hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Demander une réservation
                              </button>
                            )}
                          </Tooltip>
                          <button
                            type="button"
                            disabled={startingChat}
                            data-chat="1"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (startingChat) return;
                              if (!isLoaded) { setChatError("Chargement de la session… Réessaie dans une seconde."); return; }
                              if (!isSignedIn) { setChatError("Veuillez vous connecter pour envoyer un message."); return; }
                              setStartingChat(true);
                              setChatError(null);
                              void (async () => {
                                try {
                                  const res = await fetch("/api/messages/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sitterId: id }) });
                                  const payload = await res.json() as { ok?: boolean; conversationId?: string; error?: string };
                                  const conversationId = typeof payload?.conversationId === "string" ? payload.conversationId : "";
                                  if (!res.ok || !payload.ok || !conversationId) {
                                    if (res.status === 401 || payload.error === "UNAUTHORIZED") { setChatError("Veuillez vous connecter pour envoyer un message."); return; }
                                    setChatError(`Erreur serveur: ${payload.error ?? res.status}`);
                                    return;
                                  }
                                  const target = `/account/messages/${encodeURIComponent(conversationId)}`;
                                  if (typeof window !== "undefined") { window.location.assign(target); } else { router.push(target); }
                                } catch { setChatError("Erreur réseau. Réessaie."); } finally { setStartingChat(false); }
                              })();
                            }}
                            className="mb-4 flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {startingChat ? "Ouverture…" : "Envoyer un message"}
                          </button>
                          <div className="grid gap-2.5 border-t border-slate-100 pt-4">
                            <div className="flex items-center gap-2.5"><Shield className="h-4 w-4 text-emerald-500" /><span className="text-xs text-slate-600">Sitter vérifié</span></div>
                            <div className="flex items-center gap-2.5"><CreditCard className="h-4 w-4 text-slate-400" /><span className="text-xs text-slate-600">Paiement sécurisé Stripe</span></div>
                            <div className="flex items-center gap-2.5"><MessageCircle className="h-4 w-4 text-[var(--dogshift-blue)]" /><span className="text-xs text-slate-600">Support 7/7</span></div>
                          </div>
                        </>
                      )}
                      {chatError ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-xs font-medium text-rose-900">{chatError}{" "}<Link href="/login" className="font-semibold underline underline-offset-2">Se connecter</Link></p>
                        </div>
                      ) : null}
                      {bookingCtaError ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-xs font-medium text-rose-900">{bookingCtaError}{" "}<Link href="/login" className="font-semibold underline underline-offset-2">Se connecter</Link></p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            {/* Mobile Sticky Booking Bar */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-4 pb-safe shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] lg:hidden">
              <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{serviceUi.current.label || "Sélectionnez un service"}</p>
                  <p className="truncate text-xs text-slate-600">{bookingSelectionSummary || "Dates à définir"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (maintenanceMode) {
                      setBookingCtaError(maintenanceBookingUserMessage(adminNote));
                      return;
                    }
                    if (!isLoaded) {
                      setBookingCtaError("Chargement de la session… Réessaie dans une seconde.");
                      return;
                    }
                    if (!isSignedIn) {
                      setBookingCtaError("Veuillez vous connecter pour demander une réservation.");
                      return;
                    }
                    if (!canRequestBooking) {
                      setBookingCtaError(
                        slotsServiceType === "PENSION"
                          ? "Sélectionnez une arrivée et une date de départ valides pour continuer."
                          : "Sélectionnez un service et une date dans l'agenda pour continuer."
                      );
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      return;
                    }
                    setBookingCtaError(null);
                    void continueToReservation();
                  }}
                  disabled={maintenanceMode}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Réserver
                </button>
              </div>
              {bookingCtaError ? (
                <p className="mt-2 text-xs font-medium text-rose-600">{bookingCtaError}</p>
              ) : null}
            </div>
          </>
        ) : (
            <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-5">
                  <button
                    type="button"
                    onClick={() => setPhotoLightboxOpen(true)}
                    className="shrink-0 cursor-zoom-in focus:outline-none"
                    aria-label="Voir la photo en grand"
                  >
                    <img
                      src={sitter.avatarUrl}
                      alt={sitter.name}
                      className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200 transition-opacity hover:opacity-90"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                  <div>
                    <p className="text-xs font-semibold text-slate-600">Prévisualisation</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{sitter.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{sitter.city}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        <StarIcon className="h-4 w-4 text-[#F5B301]" />
                        {ratingLabel}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                        {reviewCountLabel} avis
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        <span className="text-slate-600">À partir de </span>
                        <span className="text-slate-900">CHF {fromPricing?.price ?? sitter.pricePerDay}</span>
                        <span className="text-slate-600">
                          {fromPricing?.unit ??
                            (typeof (sitter.pricing as unknown as Record<string, unknown> | null)?.Pension === "number" ? " / jour" : " / heure")}
                        </span>
                      </span>
                      {sitter.services.slice(0, 3).map((svc) => (
                        <span
                          key={svc}
                          className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                        >
                          {svc}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/sitter/${id}?mode=public`}
                  className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                >
                  Voir l’annonce
                </Link>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Extrait</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-4 whitespace-pre-line">{sitter.bio}</p>
              </div>
            </div>
          )}

      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-24 text-slate-900 lg:pb-0">
      {showHostChrome ? (
        <HostUserProvider value={hostUserValue}>
          <HostDashboardShell>{content}</HostDashboardShell>
        </HostUserProvider>
      ) : (
        <main className="mx-auto max-w-6xl px-4 pt-4 pb-6 sm:px-6 sm:pt-6">{content}</main>
      )}

      {photoLightboxOpen && sitter?.avatarUrl ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPhotoLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Photo agrandie"
        >
          <img
            src={sitter.avatarUrl}
            alt={sitter.name}
            className="max-h-[85vh] max-w-[85vw] rounded-3xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            referrerPolicy="no-referrer"
          />
          <button
            type="button"
            onClick={() => setPhotoLightboxOpen(false)}
            className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/40"
            aria-label="Fermer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}