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
