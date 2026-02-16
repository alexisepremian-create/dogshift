"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { User } from "lucide-react";
import { loadHostProfileFromStorage, type HostProfileV1 } from "@/lib/hostProfile";
import HostDashboardShell from "@/components/HostDashboardShell";
import { HostUserProvider, makeHostUserValuePreview } from "@/components/HostUserProvider";
import SunCornerGlow from "@/components/SunCornerGlow";
import { appendHostMessage } from "@/lib/hostMessages";
import PageLoader from "@/components/ui/PageLoader";

type ServiceType = "Promenade" | "Garde" | "Pension";

type PricingMap = Record<string, number>;

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
  availableDates: string[];
  pricing: PricingMap;
  bio: string;
  responseTime: string;
  verified: boolean;
  lat: number;
  lng: number;
  avatarUrl: string;
};

type BookingStep = "form" | "confirm" | "sent";

type AvailabilityPayload = { ok?: boolean; dates?: string[]; error?: string };

function formatRating(rating: number) {
  return rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
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

function safeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
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

  const [lockChecked, setLockChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    console.log("[LockGuard] effect start");

    let cancelled = false;
    void (async () => {
      let shouldSetChecked = true;
      let shouldRedirect = false;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4_000);
      try {
        const dbg = new URLSearchParams(window.location.search).get("dbg") === "1";
        if (dbg) console.log("[LockGuard] start", window.location.href);
        if (window.location.pathname.startsWith("/unlock")) {
          return;
        }

        const res = await fetch("/api/site-lock-status", {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; lockOn?: boolean } | null;
        if (cancelled) return;
        if (dbg) console.log("[LockGuard] status", { ok: res.ok, data });

        if (res.ok && data?.ok && data.lockOn) {
          shouldSetChecked = false;
          shouldRedirect = true;
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/unlock?next=${encodeURIComponent(next)}`);
          return;
        }
      } catch (err) {
        try {
          const dbg = new URLSearchParams(window.location.search).get("dbg") === "1";
          if (dbg) console.error("[LockGuard] error", err);
        } catch {
          // ignore
        }
      } finally {
        clearTimeout(timeout);
        if (cancelled) return;
        if (!shouldRedirect && shouldSetChecked) setLockChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!lockChecked) return <PageLoader label="Chargement…" />;
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
  if (dbg) console.log("[ProfileContent] render");
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const id = sitterId;
  if (dbg) console.log("ID used for fetch:", id);

  const { isLoaded, isSignedIn, user } = useUser();
  const isLoggedIn = Boolean(isLoaded && isSignedIn);

  const [hydrated, setHydrated] = useState(false);
  const [currentHostId, setCurrentHostId] = useState<string | null>(null);
  const [hostProfileCompletion, setHostProfileCompletion] = useState<number>(0);

  const [apiSitter, setApiSitter] = useState<SitterCard | null>(null);
  const [apiLoaded, setApiLoaded] = useState(false);

  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  const viewMode = isPreviewMode ? "preview" : "public";
  const isPublicView = !isPreviewMode;
  const isHostViewingOwn = Boolean(currentHostId && id && currentHostId === id);

  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewSitter, setPreviewSitter] = useState<SitterCard | null>(null);
  const [profileData, setProfileData] = useState<HostProfileV1 | null>(null);

  const [finalizeModalOpen, setFinalizeModalOpen] = useState(true);
  const [finalizeLoading, setFinalizeLoading] = useState(false);

  const sessionName = typeof user?.fullName === "string" ? user.fullName : "";
  const sessionImage = typeof user?.imageUrl === "string" ? user.imageUrl : null;

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

    return {
      id: profile.sitterId,
      name: profile.firstName && profile.firstName.trim() ? profile.firstName.trim() : sessionName,
      city: profile.city ?? "",
      postalCode: profile.postalCode ?? "",
      rating: null,
      reviewCount: 0,
      pricePerDay,
      services: enabledServices ?? [],
      dogSizes: [],
      availableDates: [],
      pricing: safePricingMap(pricing),
      bio: profile.bio ?? "",
      responseTime: "~1h",
      verified: profile.verificationStatus === "verified",
      lat: 0,
      lng: 0,
      avatarUrl:
        profile.avatarDataUrl && profile.avatarDataUrl.trim()
          ? profile.avatarDataUrl
          : (sessionImage ?? "https://i.pravatar.cc/160?img=7"),
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
          `/api/sitters/${encodeURIComponent(id)}${isPreviewMode ? "?mode=preview" : ""}`
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
                bio: string;
                avatarUrl: string | null;
                services: unknown;
                pricing: unknown;
                dogSizes: unknown;
                verified?: boolean;
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
          dogSizes: safeStringArray(payload.sitter.dogSizes),
          availableDates: [],
          pricing,
          bio: payload.sitter.bio ?? "",
          responseTime: "~1h",
          verified: typeof payload.sitter.verified === "boolean" ? payload.sitter.verified : false,
          lat: typeof payload.sitter.lat === "number" && Number.isFinite(payload.sitter.lat) ? payload.sitter.lat : 0,
          lng: typeof payload.sitter.lng === "number" && Number.isFinite(payload.sitter.lng) ? payload.sitter.lng : 0,
          avatarUrl: payload.sitter.avatarUrl ?? "https://i.pravatar.cc/160?img=7",
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
  }, [id, isPreviewMode]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setAvailabilityLoaded(false);
      try {
        if (dbg) console.log("[ProfileContent] fetch start");
        const res = await fetch(`/api/sitters/${encodeURIComponent(id)}/availability`, { method: "GET" });
        const payload = (await res.json().catch(() => null)) as AvailabilityPayload | null;
        if (cancelled) return;
        if (!res.ok || !payload?.ok || !Array.isArray(payload.dates)) {
          setAvailableDates([]);
          setAvailabilityLoaded(true);
          return;
        }
        if (dbg) console.log("[ProfileContent] fetch success");
        const rows = payload.dates.filter((d): d is string => typeof d === "string" && d.trim().length > 0);
        setAvailableDates(rows);
        setAvailabilityLoaded(true);
      } catch (error) {
        if (dbg) console.log("[ProfileContent] fetch error", error);
        if (cancelled) return;
        setAvailableDates([]);
        setAvailabilityLoaded(true);
      } finally {
        if (dbg) console.log("[ProfileContent] fetch finally");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    // handled below by the single /api/host/profile fetch
  }, [id]);

  useEffect(() => {
    setHydrated(true);
    if (!isLoaded || !isSignedIn) {
      setCurrentHostId(null);
      setHostProfileCompletion(0);
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
          setHostProfileCompletion(0);
          setPreviewLoaded(false);
          setPreviewSitter(null);
          setProfileData(null);
          return;
        }

        if (dbg) console.log("[ProfileContent] fetch success");
        const sitterId = typeof payload.sitterId === "string" ? payload.sitterId : null;
        const normalizedSitterId = sitterId && sitterId.trim() ? sitterId.trim() : null;
        setCurrentHostId(normalizedSitterId);

        setHostProfileCompletion(typeof payload.profileCompletion === "number" ? payload.profileCompletion : 0);

        if (!id || !normalizedSitterId) {
          setPreviewLoaded(false);
          setPreviewSitter(null);
          setProfileData(null);
          return;
        }

        const shouldLoadPreview = Boolean(isPreviewMode && normalizedSitterId === id);
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
        setHostProfileCompletion(0);
        setPreviewLoaded(false);
        setPreviewSitter(null);
        setProfileData(null);
      } finally {
        if (dbg) console.log("[ProfileContent] fetch finally");
      }
    })();
  }, [id, isLoaded, isSignedIn, isPreviewMode]);

  useEffect(() => {
    // handled above
  }, [hydrated]);

  const sitter = useMemo(() => {
    if (isPreviewMode && isHostViewingOwn) {
      if (!previewLoaded) return undefined;
      if (previewSitter) return previewSitter;

      // If no draft profile is available for preview, fall back to the DB-backed API profile.
      if (!apiLoaded) return undefined;
      return apiSitter ?? null;
    }

    if (!apiLoaded) return undefined;
    return apiSitter ?? null;
  }, [apiLoaded, apiSitter, isHostViewingOwn, isPreviewMode, previewLoaded, previewSitter]);

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

  async function pay() {
    if (paying) return;
    setPaying(true);
    setPayError(null);

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

      const bookingPayload = (await bookingRes.json()) as { ok?: boolean; bookingId?: string; error?: string };
      const bookingId = typeof bookingPayload?.bookingId === "string" ? bookingPayload.bookingId : "";

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

  const boardingDetails = profileData?.boardingDetails;
  const showBoardingDetails = Boolean(profileData?.services?.Pension) &&
    Boolean(
      boardingDetails &&
        (boardingDetails.housingType ||
          (typeof boardingDetails.hasGarden === "boolean") ||
          (typeof boardingDetails.hasOtherPets === "boolean") ||
          (typeof boardingDetails.notes === "string" && boardingDetails.notes.trim()))
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
  const showFullListing = !isHostViewingOwnStable || viewMode === "public" || isPreviewMode;
  const showHostChrome = isPreviewMode || (isHostViewingOwnStable && viewMode !== "public");
  const disableSelfActions = isPreviewMode || isHostViewingOwnStable;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoStartChat, id, isLoggedIn, disableSelfActions]);

  const hostUserValue = useMemo(
    () => makeHostUserValuePreview({ sitterId: currentHostId, profile: profileData }),
    [currentHostId, profileData]
  );

  const nextAvail = useMemo(() => {
    const rows = Array.isArray(availableDates) ? availableDates : [];
    return rows.slice(0, 3);
  }, [availableDates]);

  const isHostPreview = showHostChrome && isPreviewMode;
  const shouldShowFinalizeModal = isHostPreview && hostProfileCompletion < 100;

  const [slotsServiceType, setSlotsServiceType] = useState<"PROMENADE" | "DOGSITTING" | "PENSION">("PROMENADE");
  const [slotsDate, setSlotsDate] = useState<string>("");
  const [boardingStart, setBoardingStart] = useState<string>("");
  const [boardingEnd, setBoardingEnd] = useState<string>("");
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
  const [serviceSummary, setServiceSummary] = useState<
    | {
        minDurationMin: number;
        stepMin: number;
        leadTimeMin: number;
        bufferBeforeMin: number;
        bufferAfterMin: number;
      }
    | null
  >(null);
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
    }>
  >([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [monthRetryKey, setMonthRetryKey] = useState(0);

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

  useEffect(() => {
    if (slotsDate) return;
    try {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      setSlotsDate(today);
    } catch {
      setSlotsDate(new Date().toISOString().slice(0, 10));
    }
  }, [slotsDate]);

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
      }
    >();
    for (const row of monthDays) {
      if (!row || typeof row.date !== "string") continue;
      map.set(row.date, {
        promenadeStatus: row.promenadeStatus,
        dogsittingStatus: row.dogsittingStatus,
        pensionStatus: row.pensionStatus,
      });
    }
    return map;
  }, [monthDays]);

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

  useEffect(() => {
    setSelectedSlot(null);
    setSelectedSlotNotice(null);
  }, [slotsDate, slotsServiceType]);

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
    if (boardingStart) return;
    if (!slotsDate) return;
    setBoardingStart(slotsDate);
    setBoardingEnd(slotsDate);
  }, [boardingEnd, boardingStart, slotsDate]);

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
                  stepMin?: number;
                  leadTimeMin?: number;
                  bufferBeforeMin?: number;
                  bufferAfterMin?: number;
                };
                slots: Array<{ startAt: string; endAt: string; status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; reason?: string }>;
              }
            | { ok: false; error: string }
            | null;
          if (cancelled) return;
          if (!res.ok || !payload || !payload.ok || !Array.isArray((payload as any).slots)) {
            const err = (payload as any)?.error;
            setSlotsError(typeof err === "string" ? err : "SLOTS_ERROR");
            setDaySlots([]);
            setServiceSummary(null);
            return;
          }

          const cfg = (payload as any)?.config;
          if (cfg && typeof cfg === "object") {
            setServiceSummary({
              minDurationMin: typeof cfg.minDurationMin === "number" ? cfg.minDurationMin : 0,
              stepMin: typeof cfg.stepMin === "number" ? cfg.stepMin : 0,
              leadTimeMin: typeof cfg.leadTimeMin === "number" ? cfg.leadTimeMin : 0,
              bufferBeforeMin: typeof cfg.bufferBeforeMin === "number" ? cfg.bufferBeforeMin : 0,
              bufferAfterMin: typeof cfg.bufferAfterMin === "number" ? cfg.bufferAfterMin : 0,
            });
          } else {
            setServiceSummary(null);
          }

          const slots = payload.slots.filter(
            (s): s is { startAt: string; endAt: string; status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; reason?: string } =>
              Boolean(s && typeof s.startAt === "string" && typeof s.endAt === "string" && typeof (s as any).status === "string")
          );
          setDaySlots(slots);
        } catch (error) {
          if (cancelled) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (dbg) console.log("[ProfileContent] fetch error", error);
          setSlotsError("SLOTS_NETWORK_ERROR");
          setDaySlots([]);
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
    return <PageLoader label="Chargement…" />;
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

  const content = (
    <div className="relative grid gap-6 overflow-hidden" data-testid="sitter-public-profile">
      <SunCornerGlow variant="sitterPublicPreview" />
      <div className="relative z-10">
        {shouldShowFinalizeModal ? (
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
                    <Spinner className="h-4 w-4 animate-spin" />
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
          <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)]">
            <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
              <section className="p-6 sm:p-8">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-5">
                      <img
                        src={sitter.avatarUrl}
                        alt={sitter.name}
                        className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{sitter.name}</h1>
                        <p className="mt-1 text-sm text-slate-600">{sitter.city}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            <StarIcon className="h-4 w-4 text-[#F5B301]" />
                            {ratingLabel}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                            {reviewCountLabel} avis
                          </span>
                          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                            Répond en {sitter.responseTime}
                          </span>
                          {sitter.verified ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
                              Vérifié manuellement
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                      <p className="text-sm text-slate-600">Tarif</p>
                      <div className="mt-1 inline-flex items-baseline gap-1 whitespace-nowrap text-slate-900">
                        <span className="text-sm font-medium text-slate-600">À partir de</span>
                        <span className="text-base font-semibold">CHF</span>
                        <span className="text-2xl font-semibold">{fromPricing?.price ?? sitter.pricePerDay}</span>
                        <span className="text-sm font-medium text-slate-500">
                          {fromPricing?.unit ??
                            (typeof (sitter.pricing as unknown as Record<string, unknown> | null)?.Pension === "number" ? "/ jour" : " / heure")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-7 grid gap-6 sm:grid-cols-2 sm:items-stretch">
                    <div className="h-full min-h-[130px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h2 className="text-sm font-semibold text-slate-900">Services & tarifs</h2>
                      {sitter.services.length === 0 ? (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-900">Aucun service</p>
                          <p className="mt-1 text-sm text-slate-600">Ce sitter n’a pas encore renseigné ses services.</p>
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2">
                          {pricingRows.map((row) => {
                            const hasPrice = typeof row.price === "number" && Number.isFinite(row.price) && row.price > 0;
                            if (isPublicView) {
                              return (
                                <div
                                  key={row.service}
                                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900"
                                >
                                  <span>{row.service}</span>
                                  <span className={hasPrice ? "text-slate-900" : "text-slate-500"}>
                                    {hasPrice ? `CHF ${row.price}${row.service === "Pension" ? " / jour" : " / heure"}` : "Prix sur demande"}
                                  </span>
                                </div>
                              );
                            }

                            const selectable = hasPrice;
                            const interactive = selectable && !disableSelfActions;
                            const selected = selectedService === row.service;
                            return (
                              <button
                                key={row.service}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={!interactive}
                                onClick={() => {
                                  if (!interactive) return;
                                  setSelectedService(row.service);
                                  setPayError(null);
                                }}
                                className={
                                  selected
                                    ? "flex w-full items-center justify-between rounded-2xl border border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] px-4 py-3 text-left text-sm font-semibold text-[var(--dogshift-blue)]"
                                    : interactive
                                      ? "flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                                      : "flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-500"
                                }
                              >
                                <span className="flex items-center gap-2">
                                  <span
                                    className={
                                      selected
                                        ? "inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--dogshift-blue)]"
                                        : "inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-300"
                                    }
                                    aria-hidden="true"
                                  >
                                    {selected ? <span className="h-2 w-2 rounded-full bg-[var(--dogshift-blue)]" /> : null}
                                  </span>
                                  {row.service}
                                </span>
                                <span className={selected ? "text-[var(--dogshift-blue)]" : interactive ? "text-slate-900" : "text-slate-500"}>
                                  {selectable ? `CHF ${row.price}${row.service === "Pension" ? " / jour" : " / heure"}` : "Prix sur demande"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="h-full min-h-[130px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h2 className="text-sm font-semibold text-slate-900">Disponibilités</h2>
                      <div className="mt-3">
                        <p className="text-sm font-medium text-slate-900">Prochaines disponibilités</p>
                        {!availabilityLoaded ? (
                          <p className="mt-1 text-sm text-slate-600">Chargement…</p>
                        ) : nextAvail.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {nextAvail.map((d) => (
                              <span
                                key={d}
                                className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200"
                              >
                                {formatDateFr(d)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2">
                            <p className="text-sm text-slate-600">Aucune disponibilité renseignée pour le moment.</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--dogshift-blue)]">Envoie un message pour demander une date.</p>
                          </div>
                        )}

                        <div className="mt-6">
                          <p className="text-sm font-medium text-slate-900">Service</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {([
                              { key: "PROMENADE" as const, label: "Promenade" },
                              { key: "DOGSITTING" as const, label: "Dogsitting" },
                              { key: "PENSION" as const, label: "Pension" },
                            ] as const).map((svc) => {
                              const selected = slotsServiceType === svc.key;
                              return (
                                <button
                                  key={svc.key}
                                  type="button"
                                  onClick={() => setSlotsServiceType(svc.key)}
                                  className={
                                    selected
                                      ? "rounded-full bg-[var(--dogshift-blue)] px-3 py-1 text-xs font-semibold text-white"
                                      : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  }
                                  aria-pressed={selected}
                                >
                                  {serviceUi.byKey[svc.key].icon} {svc.label}
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-5">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-slate-900">Calendrier</p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setMonthCursor((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1, 0, 0, 0, 0)))}
                                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                                  aria-label="Mois précédent"
                                >
                                  ◀
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMonthCursor((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0)))}
                                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                                  aria-label="Mois suivant"
                                >
                                  ▶
                                </button>
                              </div>
                            </div>

                            <p className="mt-2 text-sm font-semibold text-slate-900">{monthMeta.monthLabel}</p>

                            {monthLoading ? (
                              <div className="mt-3 grid gap-2" aria-label="Chargement du calendrier">
                                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                                <div className="grid grid-cols-7 gap-2">
                                  {Array.from({ length: 21 }).map((_, i) => (
                                    <div key={`cal-skel-${i}`} className="h-10 w-full animate-pulse rounded-2xl bg-slate-200" />
                                  ))}
                                </div>
                              </div>
                            ) : monthError ? (
                              <div className="mt-2">
                                <p className="text-sm text-rose-700">{monthError}</p>
                                <button
                                  type="button"
                                  onClick={() => setMonthRetryKey((v) => v + 1)}
                                  className="mt-2 inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
                                >
                                  Réessayer
                                </button>
                              </div>
                            ) : (
                              <div className="mt-3">
                                <div className="rounded-2xl border border-slate-200 bg-white p-3" aria-label="Légende disponibilités">
                                  <p className="text-xs font-semibold text-slate-700">Légende</p>
                                  <div className="mt-2 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                                    <div className="flex items-center gap-2">
                                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                      <span>Disponible</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
                                      <span>Sur demande</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" aria-hidden="true" />
                                      <span>Indisponible</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-slate-500">
                                  <div>L</div>
                                  <div>M</div>
                                  <div>M</div>
                                  <div>J</div>
                                  <div>V</div>
                                  <div>S</div>
                                  <div>D</div>
                                </div>

                                <div className="mt-2 grid grid-cols-7 gap-2">
                                  {Array.from({ length: monthMeta.mondayIndex }).map((_, i) => (
                                    <div key={`pad-${i}`} />
                                  ))}
                                  {Array.from({ length: monthMeta.daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const dateIso = `${String(monthMeta.year).padStart(4, "0")}-${String(monthMeta.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                    const row = monthDaysByDate.get(dateIso) ?? {
                                      promenadeStatus: "UNAVAILABLE" as const,
                                      dogsittingStatus: "UNAVAILABLE" as const,
                                      pensionStatus: "UNAVAILABLE" as const,
                                    };

                                    const statusTone = (status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") =>
                                      status === "AVAILABLE"
                                        ? "bg-emerald-500"
                                        : status === "ON_REQUEST"
                                          ? "bg-amber-500"
                                          : "bg-slate-300";

                                    const cellTone =
                                      slotsServiceType === "PROMENADE"
                                        ? row.promenadeStatus
                                        : slotsServiceType === "DOGSITTING"
                                          ? row.dogsittingStatus
                                          : row.pensionStatus;

                                    const tone =
                                      cellTone === "AVAILABLE"
                                        ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                                        : cellTone === "ON_REQUEST"
                                          ? "bg-amber-50 text-amber-900 ring-amber-200"
                                          : "bg-slate-100 text-slate-500 ring-slate-200";

                                    const ariaLabel =
                                      `${dateIso} — ` +
                                      `Promenade: ${serviceUi.statusLabel(row.promenadeStatus)}; ` +
                                      `Dogsitting: ${serviceUi.statusLabel(row.dogsittingStatus)}; ` +
                                      `Pension: ${serviceUi.statusLabel(row.pensionStatus)}`;

                                    const focusRing =
                                      slotsServiceType === "PROMENADE"
                                        ? "ring-[2px] ring-emerald-500/30"
                                        : slotsServiceType === "DOGSITTING"
                                          ? "ring-[2px] ring-indigo-500/30"
                                          : "ring-[2px] ring-fuchsia-500/30";
                                    return (
                                      <div key={dateIso} className={`flex h-10 w-full flex-col items-center justify-center rounded-2xl ring-1 ${tone} ${focusRing}`}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSlotsDate(dateIso);
                                            if (slotsServiceType === "PENSION") {
                                              if (!boardingStart) {
                                                setBoardingStart(dateIso);
                                                setBoardingEnd(dateIso);
                                              } else {
                                                setBoardingEnd(dateIso);
                                              }
                                            }
                                          }}
                                          className="flex w-full flex-1 flex-col items-center justify-center rounded-2xl"
                                          aria-label={ariaLabel}
                                        >
                                          <span className="text-sm font-semibold leading-none">{day}</span>
                                        </button>
                                        <div className="-mt-1 flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSlotsServiceType("PROMENADE");
                                              setSlotsDate(dateIso);
                                            }}
                                            className={`h-2 w-2 rounded-full ${statusTone(row.promenadeStatus)}`}
                                            aria-label={`${dateIso} — ${serviceUi.byKey.PROMENADE.icon} Promenade: ${serviceUi.statusLabel(row.promenadeStatus)}`}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSlotsServiceType("DOGSITTING");
                                              setSlotsDate(dateIso);
                                            }}
                                            className={`h-2 w-2 rounded-full ${statusTone(row.dogsittingStatus)}`}
                                            aria-label={`${dateIso} — ${serviceUi.byKey.DOGSITTING.icon} Dogsitting: ${serviceUi.statusLabel(row.dogsittingStatus)}`}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSlotsServiceType("PENSION");
                                              setSlotsDate(dateIso);
                                              if (!boardingStart) {
                                                setBoardingStart(dateIso);
                                                setBoardingEnd(dateIso);
                                              }
                                            }}
                                            className={`h-2 w-2 rounded-full ${statusTone(row.pensionStatus)}`}
                                            aria-label={`${dateIso} — ${serviceUi.byKey.PENSION.icon} Pension: ${serviceUi.statusLabel(row.pensionStatus)}`}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-4">
                            <label className="text-sm font-medium text-slate-900" htmlFor="slots-date">
                              Date
                            </label>
                            <input
                              id="slots-date"
                              type="date"
                              value={slotsDate}
                              onChange={(e) => setSlotsDate(e.target.value)}
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                            />
                          </div>

                          <div className="mt-4">
                            <p className="text-sm font-medium text-slate-900">
                              Créneaux (service sélectionné)
                              <span className="ml-2 text-sm font-semibold text-slate-700">
                                {serviceUi.current.icon} {serviceUi.current.label}
                              </span>
                            </p>
                            {serviceSummary ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  Durée min: {serviceSummary.minDurationMin} min
                                </span>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  Pas: {serviceSummary.stepMin} min
                                </span>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  Lead: {serviceSummary.leadTimeMin} min
                                </span>
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  Buffer: {serviceSummary.bufferBeforeMin}/{serviceSummary.bufferAfterMin} min
                                </span>
                              </div>
                            ) : null}

                            {slotsServiceType === "PENSION" ? (
                              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-sm font-semibold text-slate-900">Séjour (multi-jours)</p>
                                <p className="mt-1 text-sm text-slate-600">Sélectionnez une arrivée et un départ.</p>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="text-xs font-semibold text-slate-700" htmlFor="boarding-start">
                                      Arrivée
                                    </label>
                                    <input
                                      id="boarding-start"
                                      type="date"
                                      value={boardingStart}
                                      onChange={(e) => setBoardingStart(e.target.value)}
                                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-slate-700" htmlFor="boarding-end">
                                      Départ
                                    </label>
                                    <input
                                      id="boarding-end"
                                      type="date"
                                      value={boardingEnd}
                                      onChange={(e) => setBoardingEnd(e.target.value)}
                                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="mt-4">
                                  {boardingStatusLoading ? (
                                    <p className="text-sm text-slate-600">Vérification…</p>
                                  ) : boardingStatusError ? (
                                    <div>
                                      <p className="text-sm text-rose-700">{boardingStatusError}</p>
                                      <button
                                        type="button"
                                        onClick={() => setBoardingStatusRetryKey((v) => v + 1)}
                                        className="mt-2 inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
                                      >
                                        Réessayer
                                      </button>
                                    </div>
                                  ) : boardingStatus ? (
                                    <div>
                                      <div
                                        className={
                                          boardingStatus.status === "AVAILABLE"
                                            ? "inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200"
                                            : boardingStatus.status === "ON_REQUEST"
                                              ? "inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200"
                                              : "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
                                        }
                                      >
                                        {boardingStatus.status === "AVAILABLE"
                                          ? "Disponible"
                                          : boardingStatus.status === "ON_REQUEST"
                                            ? "Sur demande"
                                            : "Indisponible"}
                                      </div>
                                      {boardingStatus.status === "ON_REQUEST" ? (
                                        <p className="mt-2 text-sm text-slate-600">Certains jours sont sur demande.</p>
                                      ) : null}

                                      {boardingStatus.status === "UNAVAILABLE" && boardingStatus.blockingDays?.length ? (
                                        <div className="mt-3">
                                          <p className="text-sm font-semibold text-slate-900">Jours bloquants</p>
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {boardingStatus.blockingDays.map((d) => (
                                              <span
                                                key={d.date}
                                                className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                                                title={dbg ? d.reason ?? "" : ""}
                                              >
                                                {formatDateFr(d.date)}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}

                                      {dbg && boardingStatus.days.length ? (
                                        <div className="mt-3">
                                          <p className="text-xs font-semibold text-slate-500">dbg</p>
                                          <div className="mt-1 grid gap-1 text-xs text-slate-600">
                                            {boardingStatus.days.map((d) => (
                                              <div key={d.date}>
                                                {d.date} — {d.status}
                                                {d.reason ? ` (${d.reason})` : ""}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedService("Pension");
                                      setBookingStart(boardingStart);
                                      setBookingEnd(boardingEnd);
                                      setBookingStartAt("");
                                      setBookingEndAt("");
                                      setBookingOpen(true);
                                    }}
                                    disabled={boardingStatus?.status === "UNAVAILABLE"}
                                    className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Continuer
                                  </button>
                                </div>
                              </div>
                            ) : slotsLoading ? (
                              <div className="mt-3 grid gap-2" aria-label="Chargement des créneaux">
                                {Array.from({ length: 4 }).map((_, i) => (
                                  <div key={`slots-skel-${i}`} className="h-12 w-full animate-pulse rounded-2xl bg-slate-200" />
                                ))}
                              </div>
                            ) : slotsError ? (
                              <div className="mt-2">
                                <p className="text-sm text-rose-700">{slotsError}</p>
                                <button
                                  type="button"
                                  onClick={() => setSlotsRetryKey((v) => v + 1)}
                                  className="mt-2 inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
                                >
                                  Réessayer
                                </button>
                              </div>
                            ) : daySlots.length ? (
                              <div className="mt-3 grid gap-3">
                                {daySlotsAgenda.map((group) => (
                                  <div key={group.key}>
                                    <p className="text-xs font-semibold text-slate-500">{group.label}</p>
                                    <div className="mt-2 grid gap-2">
                                      {group.items.map((slot) => {
                                        const isUnavailable = slot.status === "UNAVAILABLE";
                                        const isOnRequest = slot.status === "ON_REQUEST";
                                        const isSelected =
                                          Boolean(selectedSlot) &&
                                          selectedSlot?.serviceType === slotsServiceType &&
                                          selectedSlot?.dateIso === slotsDate &&
                                          selectedSlot?.startAt === slot.startAt &&
                                          selectedSlot?.endAt === slot.endAt;
                                        const tone = isUnavailable
                                          ? "border-slate-200 bg-slate-100 text-slate-500"
                                          : isOnRequest
                                            ? "border-amber-200 bg-amber-50 text-amber-900"
                                            : "border-emerald-200 bg-emerald-50 text-emerald-900";
                                        const label = `${slot.startAt.slice(11, 16)}–${slot.endAt.slice(11, 16)}`;
                                        const statusText = serviceUi.statusLabelLong(slot.status);
                                        const ariaLabel = `${serviceUi.current.icon} ${serviceUi.current.label} ${label} — ${statusText}`;
                                        const tooltip = dbg ? slot.reason ?? "" : statusText;
                                        return (
                                          <button
                                            key={`${slot.startAt}-${slot.endAt}-${slot.status}-${slot.reason ?? ""}`}
                                            type="button"
                                            disabled={isUnavailable}
                                            title={tooltip}
                                            onClick={() => {
                                              if (isUnavailable) return;
                                              setSelectedSlotNotice(null);
                                              if (slot.status === "AVAILABLE" || slot.status === "ON_REQUEST") {
                                                setSelectedSlot({
                                                  serviceType: slotsServiceType,
                                                  dateIso: slotsDate,
                                                  startAt: slot.startAt,
                                                  endAt: slot.endAt,
                                                  status: slot.status,
                                                  reason: slot.reason,
                                                });
                                              }
                                            }}
                                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${tone} ${
                                              isSelected ? "ring-2 ring-[var(--dogshift-blue)]" : ""
                                            }`}
                                            aria-label={ariaLabel}
                                            aria-pressed={isSelected}
                                          >
                                            <span>{label}</span>
                                            <span className="text-xs font-semibold">{serviceUi.statusLabel(slot.status)}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}

                                {selectedSlotNotice ? (
                                  <p className="text-sm font-semibold text-amber-900">{selectedSlotNotice}</p>
                                ) : null}

                                {selectedSlot ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const serviceName = selectedSlot.serviceType === "PROMENADE" ? "Promenade" : "Garde";
                                      setSelectedService(serviceName);
                                      setBookingStartAt(selectedSlot.startAt);
                                      setBookingEndAt(selectedSlot.endAt);
                                      setBookingStart("");
                                      setBookingEnd("");
                                      setBookingOpen(true);
                                    }}
                                    className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white"
                                  >
                                    {selectedSlot.status === "AVAILABLE" ? "Réserver ce créneau" : "Demander ce créneau"}
                                  </button>
                                ) : (
                                  <p className="text-sm text-slate-600">Sélectionnez un créneau pour continuer.</p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-slate-600">Aucun créneau.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {showBoardingDetails ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h2 className="text-sm font-semibold text-slate-900">Pension (détails)</h2>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {boardingDetails?.housingType ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs font-semibold text-slate-500">Type de logement</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{boardingDetails.housingType}</p>
                          </div>
                        ) : null}

                        {typeof boardingDetails?.hasGarden === "boolean" ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs font-semibold text-slate-500">Jardin</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{boardingDetails.hasGarden ? "Oui" : "Non"}</p>
                          </div>
                        ) : null}

                        {typeof boardingDetails?.hasOtherPets === "boolean" ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs font-semibold text-slate-500">Autres animaux</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{boardingDetails.hasOtherPets ? "Oui" : "Non"}</p>
                          </div>
                        ) : null}

                        {typeof boardingDetails?.notes === "string" && boardingDetails.notes.trim() ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
                            <p className="text-xs font-semibold text-slate-500">Notes</p>
                            <p className="mt-1 text-sm text-slate-700">{boardingDetails.notes.trim()}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-7">
                    <h2 className="text-sm font-semibold text-slate-900">À propos</h2>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{sitter.bio}</p>
                  </div>
                </section>

                <aside className="border-t border-slate-200 p-6 sm:p-8 lg:border-l lg:border-t-0">
                  <h2 className="text-sm font-semibold text-slate-900">Actions</h2>
                  <div
                    ref={actionsRef}
                    className="mt-5 space-y-3"
                    onClickCapture={(e) => {
                      if (process.env.NODE_ENV === "production") return;
                      const t = e.target as HTMLElement | null;
                      const ct = e.currentTarget as HTMLElement | null;
                      console.log("[sitter][actions][capture]", {
                        sitterId: id,
                        disableSelfActions,
                        target: t?.tagName,
                        targetId: t?.id,
                        targetClass: t?.className,
                        currentTarget: ct?.tagName,
                        currentTargetId: ct?.id,
                        currentTargetClass: ct?.className,
                      });
                    }}
                  >
                    {disableSelfActions ? (
                      <Link
                        href="/host/messages"
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                      >
                        Voir mes messages
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={startingChat}
                        onClickCapture={(e) => {
                          if (process.env.NODE_ENV !== "production") {
                            console.log("[sitter][cta][capture]", {
                              id,
                              mode: viewMode,
                              isLoaded,
                              isSignedIn,
                              disableSelfActions,
                              defaultPrevented: e.defaultPrevented,
                            });
                          }
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (process.env.NODE_ENV !== "production") {
                            console.log("[sitter][cta][click]", {
                              id,
                              mode: viewMode,
                              isLoaded,
                              isSignedIn,
                              disableSelfActions,
                            });
                          }
                          if (startingChat) return;
                          if (!isLoaded) {
                            setChatError("Chargement de la session… Réessaie dans une seconde.");
                            return;
                          }
                          if (!isSignedIn) {
                            setChatError("Veuillez vous connecter pour envoyer un message.");
                            return;
                          }

                          setStartingChat(true);
                          setChatError(null);
                          void (async () => {
                            try {
                              if (process.env.NODE_ENV !== "production") {
                                console.log("[sitter][cta] creating conversation", { sitterId: id });
                              }
                              if (process.env.NODE_ENV !== "production") {
                                console.log("[sitter][cta] about to POST /api/messages/conversations", { sitterId: id });
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
                                  setChatError("Veuillez vous connecter pour envoyer un message.");
                                  return;
                                }
                                setChatError(`Erreur serveur: ${payload.error ?? res.status}`);
                                return;
                              }
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
                        }}
                        className="w-full rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {startingChat ? "Ouverture…" : "Envoyer un message"}
                      </button>
                    )}

                    {chatError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <p className="text-sm font-medium text-rose-900">
                          {chatError}{" "}
                          <Link href="/login" className="font-semibold underline underline-offset-2">
                            Se connecter
                          </Link>
                        </p>
                      </div>
                    ) : null}

                    {disableSelfActions ? (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-2xl bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-500"
                      >
                        Demander une réservation
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isLoaded) {
                            setBookingCtaError("Chargement de la session… Réessaie dans une seconde.");
                            return;
                          }
                          if (!isSignedIn) {
                            setBookingCtaError("Veuillez vous connecter pour demander une réservation.");
                            return;
                          }
                          setBookingCtaError(null);
                          router.push(`/sitter/${encodeURIComponent(id)}/reservation`);
                        }}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                      >
                        Demander une réservation
                      </button>
                    )}

                    {bookingCtaError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <p className="text-sm font-medium text-rose-900">
                          {bookingCtaError}{" "}
                          <Link href="/login" className="font-semibold underline underline-offset-2">
                            Se connecter
                          </Link>
                        </p>
                      </div>
                    ) : null}

                    {disableSelfActions ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Vous ne pouvez pas vous contacter vous-même.</p>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-medium text-slate-900">Sécurité</p>
                      <p className="mt-1 text-sm text-slate-600">Paiement sécurisé via Stripe. Confirmation finale via webhook.</p>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-5">
                  <img
                    src={sitter.avatarUrl}
                    alt={sitter.name}
                    className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
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
                <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-4">{sitter.bio}</p>
              </div>
            </div>
          )}

        {showHostChrome ? null : null}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {showHostChrome ? (
        <HostUserProvider value={hostUserValue}>
          <HostDashboardShell>{content}</HostDashboardShell>
        </HostUserProvider>
      ) : (
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{content}</main>
      )}
    </div>
  );
}