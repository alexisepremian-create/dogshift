type HostLikeProfile = {
  avatarDataUrl?: unknown;
  firstName?: unknown;
  city?: unknown;
  bio?: unknown;
  services?: unknown;
  pricing?: unknown;
  dogSizes?: unknown;
  verificationStatus?: unknown;
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

export function computeSitterProfileCompletion(profile: unknown): number {
  const p = (profile && typeof profile === "object" ? (profile as HostLikeProfile) : {}) as HostLikeProfile;

  const avatarOk = Boolean(toStringOrEmpty(p.avatarDataUrl));
  const firstNameOk = Boolean(toStringOrEmpty(p.firstName));
  const cityOk = Boolean(toStringOrEmpty(p.city));
  const identityOk = firstNameOk && cityOk;

  const bioOk = Boolean(toStringOrEmpty(p.bio));

  const services = toRecord(p.services);
  const enabledServices = Object.keys(services).filter((k) => Boolean(services[k]));
  const servicesOk = enabledServices.length > 0;

  const pricing = toRecord(p.pricing);
  const pricingOk = servicesOk
    ? enabledServices.every((svc) => typeof pricing[svc] === "number" && Number.isFinite(pricing[svc] as number))
    : false;

  const dogSizes = toRecord(p.dogSizes);
  const dogSizesOk = Object.keys(dogSizes).some((k) => Boolean(dogSizes[k]));

  const verificationOk = p.verificationStatus === "verified";

  const checks = [avatarOk, identityOk, verificationOk, bioOk, servicesOk, pricingOk, dogSizesOk];
  const total = checks.length;
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / total) * 100);
}
