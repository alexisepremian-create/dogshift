/**
 * Single source of truth for “services actifs” visibles côté public (fiche /search, /sitter/[id], cartes).
 * Aligné sur ServiceConfig.enabled avec repli tarifs JSON puis champ legacy `services` du profil.
 */

export const PUBLIC_SERVICE_ORDER = ["Promenade", "Garde", "Pension"] as const;
export type PublicServiceLabel = (typeof PUBLIC_SERVICE_ORDER)[number];

export function serviceTypeEnumToPublicLabel(serviceType: string): PublicServiceLabel | null {
  if (serviceType === "PROMENADE") return "Promenade";
  if (serviceType === "DOGSITTING") return "Garde";
  if (serviceType === "PENSION") return "Pension";
  return null;
}

/** Tarifs persistés avec montants > 0 (clés métier Promenade / Garde / Pension). */
export function normalizePersistedPublicPricing(raw: unknown): Partial<Record<PublicServiceLabel, number>> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const out: Partial<Record<PublicServiceLabel, number>> = {};
  if (typeof obj.Promenade === "number" && Number.isFinite(obj.Promenade) && obj.Promenade > 0) out.Promenade = obj.Promenade;
  if (typeof obj.Garde === "number" && Number.isFinite(obj.Garde) && obj.Garde > 0) out.Garde = obj.Garde;
  if (typeof obj.Pension === "number" && Number.isFinite(obj.Pension) && obj.Pension > 0) out.Pension = obj.Pension;
  return out;
}

/** Ancien format `SitterProfile.services` (tableau ou flags booléens). */
export function normalizePublicServicesField(raw: unknown): PublicServiceLabel[] {
  const found = new Set<PublicServiceLabel>();
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (value === "Promenade" || value === "Garde" || value === "Pension") found.add(value);
    }
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of PUBLIC_SERVICE_ORDER) {
      if (obj[key] === true) found.add(key);
    }
  }
  return PUBLIC_SERVICE_ORDER.filter((service) => found.has(service));
}

type ServiceConfigRow = { serviceType: string; enabled: boolean };

/**
 * 1) Au moins un service avec `enabled: true` dans ServiceConfig → liste dérivée uniquement de là.
 * 2) Sinon, clés de tarif public (> 0).
 * 3) Sinon, champ JSON `services` du profil.
 */
export function resolvePublicEnabledServices(params: {
  serviceConfigs: ServiceConfigRow[];
  pricing: unknown;
  servicesJson: unknown;
}): PublicServiceLabel[] {
  const fromConfig = params.serviceConfigs
    .filter((row) => row && row.enabled === true)
    .map((row) => serviceTypeEnumToPublicLabel(String(row.serviceType ?? "")))
    .filter((v): v is PublicServiceLabel => v !== null);

  if (fromConfig.length > 0) {
    return PUBLIC_SERVICE_ORDER.filter((s) => fromConfig.includes(s));
  }

  const pricingNorm = normalizePersistedPublicPricing(params.pricing);
  const fromPricing = Object.keys(pricingNorm).filter((k): k is PublicServiceLabel =>
    k === "Promenade" || k === "Garde" || k === "Pension"
  );
  if (fromPricing.length > 0) {
    return PUBLIC_SERVICE_ORDER.filter((s) => fromPricing.includes(s));
  }

  return normalizePublicServicesField(params.servicesJson);
}
