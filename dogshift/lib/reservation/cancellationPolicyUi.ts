const MS_24H = 24 * 60 * 60 * 1000;

export type CancellationPolicyVariant = "standard" | "lastMinute";

/** Same window as annulation propriétaire : standard tant qu’il reste au moins 24 h avant le début (`start - now >= 24h`). */
export function cancellationPolicyVariantFromStartMs(serviceStartMs: number | null | undefined): CancellationPolicyVariant {
  if (serviceStartMs == null || !Number.isFinite(serviceStartMs)) return "standard";
  return serviceStartMs - Date.now() < MS_24H ? "lastMinute" : "standard";
}
