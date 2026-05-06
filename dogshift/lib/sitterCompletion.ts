type HostLikeProfile = {
  avatarDataUrl?: unknown;
  avatarUrl?: unknown;
  firstName?: unknown;
  city?: unknown;
  bio?: unknown;
  services?: unknown;
  pricing?: unknown;
  dogSizes?: unknown;
  acceptsSmall?: unknown;
  acceptsMedium?: unknown;
  acceptsLarge?: unknown;
  stripeAccountStatus?: unknown;
};

function toStringOrEmpty(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function toRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {};
  return v as Record<string, unknown>;
}

export function normalizeCompletionPricing(raw: unknown) {
  if (!raw || typeof raw !== "object") return {} as Record<string, number>;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  if (typeof obj.Promenade === "number" && Number.isFinite(obj.Promenade) && obj.Promenade > 0) out.Promenade = obj.Promenade;
  if (typeof obj.Garde === "number" && Number.isFinite(obj.Garde) && obj.Garde > 0) out.Garde = obj.Garde;
  if (typeof obj.Pension === "number" && Number.isFinite(obj.Pension) && obj.Pension > 0) out.Pension = obj.Pension;
  return out;
}

export function mergeCompletionEnabledServices(profile: unknown, enabledServiceTypes: string[]) {
  const baseProfile = profile && typeof profile === "object" ? (profile as Record<string, unknown>) : {};
  const currentServices =
    baseProfile.services && typeof baseProfile.services === "object" ? (baseProfile.services as Record<string, unknown>) : {};

  // If no serviceConfig entries exist yet, keep the profile JSON's services as-is
  // so completion stays consistent with what the profile edit page shows.
  if (enabledServiceTypes.length === 0) {
    return {
      ...baseProfile,
      services: currentServices,
    };
  }

  return {
    ...baseProfile,
    services: {
      ...currentServices,
      Promenade: enabledServiceTypes.includes("PROMENADE"),
      Garde: enabledServiceTypes.includes("DOGSITTING"),
      Pension: enabledServiceTypes.includes("PENSION"),
    },
  };
}

export function buildEffectiveSitterCompletionProfile(args: {
  profile: unknown;
  enabledServiceTypes: string[];
  persistedPricing?: unknown;
}) {
  const mergedWithServices = mergeCompletionEnabledServices(args.profile, args.enabledServiceTypes);
  return {
    ...(mergedWithServices && typeof mergedWithServices === "object" ? mergedWithServices : {}),
    pricing: {
      ...((mergedWithServices && typeof mergedWithServices === "object" && (mergedWithServices as Record<string, unknown>).pricing && typeof (mergedWithServices as Record<string, unknown>).pricing === "object")
        ? ((mergedWithServices as Record<string, unknown>).pricing as Record<string, unknown>)
        : {}),
      ...normalizeCompletionPricing(args.persistedPricing),
    },
  };
}

export type ProfileCompletionChecks = {
  avatar: boolean;
  identity: boolean;
  bio: boolean;
  services: boolean;
  pricing: boolean;
  dogSizes: boolean;
  stripeConnected: boolean;
};

export function computeSitterProfileCompletionDetails(profile: unknown): {
  percent: number;
  checks: ProfileCompletionChecks;
} {
  const p = (profile && typeof profile === "object" ? (profile as HostLikeProfile) : {}) as HostLikeProfile;

  const avatar = Boolean(toStringOrEmpty(p.avatarDataUrl)) || Boolean(toStringOrEmpty(p.avatarUrl as string));
  const identity = Boolean(toStringOrEmpty(p.firstName)) && Boolean(toStringOrEmpty(p.city));
  const bio = Boolean(toStringOrEmpty(p.bio));

  const svcRecord = toRecord(p.services);
  const enabledServices = Object.keys(svcRecord).filter((k) => Boolean(svcRecord[k]));
  const services = enabledServices.length > 0;

  const pricingRecord = toRecord(p.pricing);
  const pricing = services
    ? enabledServices.every((svc) => typeof pricingRecord[svc] === "number" && Number.isFinite(pricingRecord[svc] as number))
    : false;

  const hasNewAccepts = p.acceptsSmall === true || p.acceptsMedium === true || p.acceptsLarge === true;
  const dogSizeRecord = toRecord(p.dogSizes);
  const hasLegacyDogSizes = Object.keys(dogSizeRecord).some((k) => Boolean(dogSizeRecord[k]));
  const dogSizes = hasNewAccepts || hasLegacyDogSizes;

  const stripeConnected = typeof p.stripeAccountStatus === "string" && p.stripeAccountStatus === "ENABLED";

  const checks: ProfileCompletionChecks = { avatar, identity, bio, services, pricing, dogSizes, stripeConnected };
  const values = Object.values(checks);
  const percent = Math.round((values.filter(Boolean).length / values.length) * 100);
  return { percent, checks };
}

export function computeSitterProfileCompletion(profile: unknown): number {
  return computeSitterProfileCompletionDetails(profile).percent;
}
