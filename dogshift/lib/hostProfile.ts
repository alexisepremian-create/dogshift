import type { DogSize, MockSitter, ServiceType } from "@/lib/mockSitters";
import { loadReviewsFromStorage } from "@/lib/reviews";

export type HostVerificationStatus = "unverified" | "pending" | "verified";

export type HostListingStatus = "draft" | "published";

export type HostBoardingDetails = {
  housingType?: "Appartement" | "Maison";
  hasGarden?: boolean;
  hasOtherPets?: boolean;
  notes?: string;
};

export type HostProfileV1 = {
  profileVersion: 1;
  sitterId: string;
  firstName: string;
  city: string;
  postalCode: string;
  avatarDataUrl?: string;
  bio: string;
  services: Record<ServiceType, boolean>;
  pricing: Partial<Record<ServiceType, number>>;
  dogSizes: Record<DogSize, boolean>;
  cancellationFlexible: boolean;
  boardingDetails?: HostBoardingDetails;
  verificationStatus: HostVerificationStatus;
  listingStatus: HostListingStatus;
  publishedAt?: string;
  updatedAt: string;
};

const DEFAULT_SERVICES: Record<ServiceType, boolean> = {
  Promenade: true,
  Garde: false,
  Pension: false,
};

const DEFAULT_DOG_SIZES: Record<DogSize, boolean> = {
  Petit: false,
  Moyen: false,
  Grand: false,
};

export function hostProfileStorageKey(sitterId: string) {
  return `ds_host_profile_${sitterId}`;
}

export function getDefaultHostProfile(sitterId: string): HostProfileV1 {
  return {
    profileVersion: 1,
    sitterId,
    firstName: "",
    city: "",
    postalCode: "",
    avatarDataUrl: undefined,
    bio: "",
    services: { ...DEFAULT_SERVICES },
    pricing: {},
    dogSizes: { ...DEFAULT_DOG_SIZES },
    cancellationFlexible: true,
    boardingDetails: undefined,
    verificationStatus: "unverified",
    listingStatus: "draft",
    publishedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function clampPrice(value: number) {
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.round(value * 100) / 100;
}

export function loadHostProfileFromStorage(sitterId: string): HostProfileV1 | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(hostProfileStorageKey(sitterId));
  if (!raw) return null;
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== "object") return null;

  const p = parsed as Partial<HostProfileV1> & { profileVersion?: number };
  if (p.profileVersion !== 1) return null;
  if (!p.sitterId || typeof p.sitterId !== "string") return null;

  const servicesRaw = p.services && typeof p.services === "object" ? (p.services as Record<string, unknown>) : {};
  const dogSizesRaw = p.dogSizes && typeof p.dogSizes === "object" ? (p.dogSizes as Record<string, unknown>) : {};

  const services: Record<ServiceType, boolean> = {
    Promenade: Boolean(servicesRaw.Promenade),
    Garde: Boolean(servicesRaw.Garde),
    Pension: Boolean(servicesRaw.Pension),
  };

  const dogSizes: Record<DogSize, boolean> = {
    Petit: Boolean(dogSizesRaw.Petit),
    Moyen: Boolean(dogSizesRaw.Moyen),
    Grand: Boolean(dogSizesRaw.Grand),
  };

  const pricingRaw = p.pricing && typeof p.pricing === "object" ? (p.pricing as Record<string, unknown>) : {};
  const pricing: Partial<Record<ServiceType, number>> = {
    Promenade: typeof pricingRaw.Promenade === "number" ? clampPrice(pricingRaw.Promenade) ?? undefined : undefined,
    Garde: typeof pricingRaw.Garde === "number" ? clampPrice(pricingRaw.Garde) ?? undefined : undefined,
    Pension: typeof pricingRaw.Pension === "number" ? clampPrice(pricingRaw.Pension) ?? undefined : undefined,
  };

  const statusRaw = p.verificationStatus;
  const verificationStatus: HostVerificationStatus =
    statusRaw === "verified" || statusRaw === "pending" || statusRaw === "unverified" ? statusRaw : "unverified";

  const listingRaw = (p as Partial<HostProfileV1>).listingStatus;
  const listingStatus: HostListingStatus = listingRaw === "published" || listingRaw === "draft" ? listingRaw : "draft";
  const publishedAt = typeof (p as Partial<HostProfileV1>).publishedAt === "string" ? (p as Partial<HostProfileV1>).publishedAt : undefined;

  const boardingDetails = p.boardingDetails && typeof p.boardingDetails === "object" ? (p.boardingDetails as HostBoardingDetails) : undefined;

  return {
    profileVersion: 1,
    sitterId: p.sitterId,
    firstName: typeof p.firstName === "string" ? p.firstName : "",
    city: typeof p.city === "string" ? p.city : "",
    postalCode: typeof p.postalCode === "string" ? p.postalCode : "",
    avatarDataUrl: typeof p.avatarDataUrl === "string" ? p.avatarDataUrl : undefined,
    bio: typeof p.bio === "string" ? p.bio : "",
    services,
    pricing,
    dogSizes,
    cancellationFlexible: typeof p.cancellationFlexible === "boolean" ? p.cancellationFlexible : true,
    boardingDetails,
    verificationStatus,
    listingStatus,
    publishedAt,
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date().toISOString(),
  };
}

export function saveHostProfileToStorage(profile: HostProfileV1) {
  if (typeof window === "undefined") return;
  const next: HostProfileV1 = { ...profile, profileVersion: 1, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(hostProfileStorageKey(profile.sitterId), JSON.stringify(next));
}

export function getHostCompletion(profile: HostProfileV1) {
  const checks = {
    avatar: Boolean(profile.avatarDataUrl && profile.avatarDataUrl.trim()),
    identity: Boolean(profile.firstName.trim()) && Boolean(profile.city.trim()),
    verification: profile.verificationStatus === "verified",
    bio: Boolean(profile.bio.trim()),
    services: Object.values(profile.services).some(Boolean),
    pricing: (Object.keys(profile.services) as ServiceType[])
      .filter((svc) => profile.services[svc])
      .every((svc) => typeof profile.pricing?.[svc] === "number"),
    dogSizes: Object.values(profile.dogSizes).some(Boolean),
  };

  const total = Object.keys(checks).length;
  const done = Object.values(checks).filter(Boolean).length;
  const percent = Math.round((done / total) * 100);
  return { percent, checks };
}

export type HostTodoItem = {
  id: string;
  label: string;
  href: string;
};

export function getHostTodos(profile: HostProfileV1): HostTodoItem[] {
  const { checks } = getHostCompletion(profile);
  const items: HostTodoItem[] = [];

  if (!checks.avatar) {
    items.push({ id: "avatar", label: "Ajouter une photo", href: "/host/profile/edit#photo" });
  }
  if (!checks.services) {
    items.push({ id: "services", label: "Activer un service", href: "/host/profile/edit#services" });
  }
  if (!checks.pricing) {
    items.push({ id: "pricing", label: "Ajouter des tarifs", href: "/host/profile/edit#pricing" });
  }
  if (!checks.dogSizes) {
    items.push({ id: "dogSizes", label: "Choisir les tailles de chiens", href: "/host/profile/edit#dogSizes" });
  }
  if (!checks.bio) {
    items.push({ id: "bio", label: "Ajouter une description", href: "/host/profile/edit#description" });
  }
  if (profile.verificationStatus === "unverified") {
    items.push({ id: "verify", label: "Demander la vérification", href: "/host/profile/edit#verification" });
  }

  return items;
}

export function applyHostProfileToMockSitter(base: MockSitter, profile: HostProfileV1): MockSitter {
  const services = (Object.keys(profile.services) as ServiceType[]).filter((svc) => profile.services[svc]);
  const name = profile.firstName.trim() ? profile.firstName.trim() : base.name;

  const storedReviews = loadReviewsFromStorage(profile.sitterId);
  const reviewCount = storedReviews.length;
  const rating =
    reviewCount > 0
      ? storedReviews.reduce((acc, r) => acc + (Number.isFinite(r.rating) ? r.rating : 0), 0) / reviewCount
      : null;

  const pricing = profile.pricing ?? {};
  const pension = typeof pricing.Pension === "number" && Number.isFinite(pricing.Pension) && pricing.Pension > 0 ? pricing.Pension : null;
  const hourlyCandidates = ([
    pricing.Promenade,
    pricing.Garde,
  ] as Array<number | undefined>).filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);

  const pricePerDay = pension ?? (hourlyCandidates.length ? Math.min(...hourlyCandidates) : base.pricePerDay);

  return {
    ...base,
    name,
    city: profile.city.trim() ? profile.city.trim() : base.city,
    postalCode: profile.postalCode.trim() ? profile.postalCode.trim() : base.postalCode,
    services: services.length ? services : base.services,
    pricing: Object.keys(pricing).length ? pricing : base.pricing,
    pricePerDay,
    bio: profile.bio.trim() ? profile.bio.trim() : base.bio,
    dogSizes: (Object.keys(profile.dogSizes) as DogSize[]).filter((s) => profile.dogSizes[s]),
    avatarUrl: profile.avatarDataUrl && profile.avatarDataUrl.trim() ? profile.avatarDataUrl.trim() : base.avatarUrl,
    verified: profile.verificationStatus === "verified" ? true : false,
    reviewCount,
    rating,
  };
}
