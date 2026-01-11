"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { User } from "lucide-react";
import { loadHostProfileFromStorage, type HostProfileV1 } from "@/lib/hostProfile";
import HostDashboardShell from "@/components/HostDashboardShell";
import { HostUserProvider } from "@/components/HostUserProvider";
import SunCornerGlow from "@/components/SunCornerGlow";
import { appendHostMessage } from "@/lib/hostMessages";

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

function formatRating(rating: number) {
  return rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
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

export default function SitterProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const isLoggedIn = Boolean(isLoaded && isSignedIn);

  const [hydrated, setHydrated] = useState(false);
  const [currentHostId, setCurrentHostId] = useState<string | null>(null);

  const id = typeof params?.id === "string" ? params.id : "";
  const [apiSitter, setApiSitter] = useState<SitterCard | null>(null);
  const [apiLoaded, setApiLoaded] = useState(false);

  const viewMode = searchParams?.get("mode") ?? "";
  const isPreviewMode = viewMode === "preview";
  const isPublicView = viewMode === "public";
  const isHostViewingOwn = Boolean(currentHostId && id && currentHostId === id);

  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewSitter, setPreviewSitter] = useState<SitterCard | null>(null);
  const [profileData, setProfileData] = useState<HostProfileV1 | null>(null);

  const sessionName = typeof user?.fullName === "string" ? user.fullName : "";
  const sessionImage = typeof user?.imageUrl === "string" ? user.imageUrl : null;

  function buildSitterFromProfile(profile: HostProfileV1): SitterCard {
    const services = profile.services && typeof profile.services === "object" ? profile.services : ({} as any);
    const enabledServices = Object.keys(services).filter((k) => Boolean((services as any)[k]));
    const pricing = profile.pricing && typeof profile.pricing === "object" ? profile.pricing : {};

    const pension = typeof (pricing as any).Pension === "number" && Number.isFinite((pricing as any).Pension) && (pricing as any).Pension > 0 ? ((pricing as any).Pension as number) : null;
    const hourlyCandidates = ([(pricing as any).Promenade, (pricing as any).Garde] as Array<number | undefined>).filter(
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
    void (async () => {
      try {
        const res = await fetch(`/api/sitters/${encodeURIComponent(id)}`);
        const payload = (await res.json()) as
          | {
              ok: true;
              sitter: {
                sitterId: string;
                name: string;
                city: string;
                postalCode: string;
                bio: string;
                avatarUrl: string | null;
                services: unknown;
                pricing: unknown;
                dogSizes: unknown;
                lat: number | null;
                lng: number | null;
              };
            }
          | { ok: false; error: string };

        if (!res.ok || !payload.ok) {
          setApiSitter(null);
          setProfileData(null);
          setApiLoaded(true);
          return;
        }

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
          rating: null,
          reviewCount: 0,
          pricePerDay,
          services,
          dogSizes: safeStringArray(payload.sitter.dogSizes),
          availableDates: [],
          pricing,
          bio: payload.sitter.bio ?? "",
          responseTime: "~1h",
          verified: false,
          lat: typeof payload.sitter.lat === "number" && Number.isFinite(payload.sitter.lat) ? payload.sitter.lat : 0,
          lng: typeof payload.sitter.lng === "number" && Number.isFinite(payload.sitter.lng) ? payload.sitter.lng : 0,
          avatarUrl: payload.sitter.avatarUrl ?? "https://i.pravatar.cc/160?img=7",
        };

        setApiSitter(sitter);
        setApiLoaded(true);
      } catch {
        setApiSitter(null);
        setProfileData(null);
        setApiLoaded(true);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    // handled below by the single /api/host/profile fetch
  }, [id]);

  useEffect(() => {
    setHydrated(true);
    if (!isLoaded || !isSignedIn) {
      setCurrentHostId(null);
      setPreviewLoaded(false);
      setPreviewSitter(null);
      setProfileData(null);
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/host/profile", { method: "GET", cache: "no-store" });
        const payload = (await res.json()) as { ok?: boolean; sitterId?: string | null; profile?: unknown };
        if (!res.ok || !payload.ok) {
          setCurrentHostId(null);
          setPreviewLoaded(false);
          setPreviewSitter(null);
          setProfileData(null);
          return;
        }
        const sitterId = typeof payload.sitterId === "string" ? payload.sitterId : null;
        const normalizedSitterId = sitterId && sitterId.trim() ? sitterId.trim() : null;
        setCurrentHostId(normalizedSitterId);

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
      } catch {
        setCurrentHostId(null);
        setPreviewLoaded(false);
        setPreviewSitter(null);
        setProfileData(null);
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
      return null;
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
  const [bookingMessage, setBookingMessage] = useState("");

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (!payError) return;
    if (selectedService || bookingStart || bookingEnd) {
      setPayError(null);
    }
  }, [bookingEnd, bookingStart, payError, selectedService]);

  async function pay() {
    if (paying) return;
    setPaying(true);
    setPayError(null);

    if (!selectedService || !bookingStart || !bookingEnd) {
      setPayError("Choisissez un service et des dates avant de payer.");
      setPaying(false);
      return;
    }

    try {
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sitterId: id,
          service: selectedService,
          startDate: bookingStart,
          endDate: bookingEnd,
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
      .map((svc) => ({ svc, price: (sitter.pricing as any)?.[svc] }))
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

  const hostUserValue = useMemo(
    () => ({ sitterId: currentHostId, published: false, publishedAt: null, profile: profileData }),
    [currentHostId, profileData]
  );

  const isHostPreview = showHostChrome && isPreviewMode;

  if (sitter === undefined) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        {isHostPreview ? (
          <HostUserProvider value={hostUserValue}>
            <HostDashboardShell>
              <div className="grid gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600">Tableau de bord</p>
                  <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    <User className="h-6 w-6 text-slate-700" aria-hidden="true" />
                    <span>Profil public</span>
                  </h1>
                  <div className="mt-3 flex min-h-[32px] items-center" />
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)]">
                  <div className="h-6 w-40 rounded bg-slate-100" />
                  <div className="mt-6 h-24 w-full rounded-2xl bg-slate-50" />
                  <div className="mt-4 h-24 w-full rounded-2xl bg-slate-50" />
                </div>
              </div>
            </HostDashboardShell>
          </HostUserProvider>
        ) : (
          <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)]">
              <p className="text-sm font-semibold text-slate-900">Chargement…</p>
              <p className="mt-2 text-sm text-slate-600">Nous préparons votre annonce.</p>
            </div>
          </main>
        )}
      </div>
    );
  }

  if (sitter === null) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)]">
            <h1 className="text-xl font-semibold text-slate-900">Sitter introuvable</h1>
            <p className="mt-2 text-sm text-slate-600">Ce profil n&apos;est pas disponible.</p>
            <div className="mt-6">
              <Link
                href="/search"
                className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
              >
                Voir les sitters
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const ratingLabel = sitter.rating === null ? "—" : formatRating(sitter.rating);
  const reviewCountLabel = String(sitter.reviewCount ?? 0);

  const content = (
    <div className="relative grid gap-6 overflow-hidden" data-testid="sitter-public-profile">
      <SunCornerGlow variant="sitterPublicPreview" />
      <div className="relative z-10">
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
                        <span className="text-sm font-medium text-slate-500">{fromPricing?.unit ?? (typeof (sitter.pricing as any)?.Pension === "number" ? "/ jour" : "/ heure")}</span>
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
                        <p className="mt-1 text-sm text-slate-600">Disponibilités à confirmer lors de la demande.</p>
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
                  <div className="mt-5 space-y-3">
                    {!disableSelfActions ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">Demande de réservation</p>
                        <p className="mt-1 text-sm text-slate-600">Choisis un service et des dates pour démarrer le paiement.</p>

                        {selectedService ? (
                          <p className="mt-3 text-sm font-semibold text-slate-900">
                            Service sélectionné: <span className="text-[var(--dogshift-blue)]">{selectedService}</span>
                          </p>
                        ) : null}

                        {sitter.services.length === 0 ? (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-medium text-slate-700">Ce sitter n’a pas encore de services.</p>
                          </div>
                        ) : (
                          <div className="mt-4">
                            <p className="text-xs font-semibold text-slate-600">Service</p>
                            <div className="mt-2 grid gap-2">
                              {sitter.services.map((svc) => {
                                const price = (sitter.pricing as Record<string, number | undefined>)[svc];
                                const selectable = typeof price === "number" && Number.isFinite(price) && price > 0;
                                const selected = selectedService === svc;
                                return (
                                  <button
                                    key={svc}
                                    type="button"
                                    disabled={!selectable}
                                    onClick={() => {
                                      if (!selectable) return;
                                      setSelectedService(svc);
                                      setPayError(null);
                                    }}
                                    className={
                                      selected
                                        ? "flex w-full items-center justify-between rounded-2xl border border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] px-4 py-3 text-sm font-semibold text-[var(--dogshift-blue)]"
                                        : selectable
                                          ? "flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                                          : "flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500"
                                    }
                                  >
                                    <span>{svc}</span>
                                    <span className={selected ? "text-[var(--dogshift-blue)]" : selectable ? "text-slate-900" : "text-slate-500"}>
                                      {selectable ? `CHF ${price}${svc === "Pension" ? " / jour" : " / heure"}` : "Prix sur demande"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-xs font-semibold text-slate-600" htmlFor="booking_start">
                                  Début
                                </label>
                                <input
                                  id="booking_start"
                                  type="date"
                                  value={bookingStart}
                                  onChange={(e) => {
                                    setBookingStart(e.target.value);
                                    setPayError(null);
                                  }}
                                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600" htmlFor="booking_end">
                                  Fin
                                </label>
                                <input
                                  id="booking_end"
                                  type="date"
                                  value={bookingEnd}
                                  onChange={(e) => {
                                    setBookingEnd(e.target.value);
                                    setPayError(null);
                                  }}
                                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                                />
                              </div>
                            </div>

                            <div className="mt-4">
                              <label className="block text-xs font-semibold text-slate-600" htmlFor="booking_message">
                                Message (optionnel)
                              </label>
                              <textarea
                                id="booking_message"
                                value={bookingMessage}
                                onChange={(e) => setBookingMessage(e.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                                rows={3}
                                placeholder="Décris ton chien et tes attentes."
                              />
                            </div>
                          </div>
                        )}

                        {bookingEstimate !== null ? (
                          <p className="mt-4 text-sm font-semibold text-slate-900">
                            Estimation: CHF {bookingEstimate.toFixed(0)}
                            <span className="text-sm font-medium text-slate-500"> (montant final calculé côté serveur)</span>
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      disabled={disableSelfActions}
                      onClick={() => {
                        if (disableSelfActions) return;
                        if (startingChat) return;
                        if (!isLoggedIn) {
                          router.push("/login");
                          return;
                        }

                        setStartingChat(true);
                        setChatError(null);
                        void (async () => {
                          try {
                            const res = await fetch("/api/account/messages/conversations/start", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ sitterId: id }),
                            });
                            const payload = (await res.json()) as { ok?: boolean; conversationId?: string; error?: string };
                            const conversationId = typeof payload?.conversationId === "string" ? payload.conversationId : "";
                            if (!res.ok || !payload.ok || !conversationId) {
                              if (res.status === 401 || payload.error === "UNAUTHORIZED") {
                                setChatError("Tu dois être connecté (401).");
                                router.push("/login");
                                return;
                              }
                              setChatError(`Erreur serveur: ${payload.error ?? res.status}`);
                              return;
                            }
                            router.push(`/account/messages/${encodeURIComponent(conversationId)}`);
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

                    {chatError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <p className="text-sm font-medium text-rose-900">{chatError}</p>
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
                      <Link
                        href={`/sitter/${encodeURIComponent(id)}/reservation`}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                      >
                        Demander une réservation
                      </Link>
                    )}

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
                        <span className="text-slate-600">{fromPricing?.unit ?? (typeof (sitter.pricing as any)?.Pension === "number" ? " / jour" : " / heure")}</span>
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

        {showHostChrome ? (
          <div className="mx-auto mt-8 max-w-5xl">
            <Link href="/host" className="text-sm font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
              ← Retour au Tableau de bord
            </Link>
          </div>
        ) : null}
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