/**
 * Permanent dismissal of the sitter dashboard onboarding banners.
 *
 * The two banners ("Compte activé" / "Complète ton profil pour publier") used
 * to be dismissed via localStorage only — which is wiped on logout / cache
 * clear / private mode, so they kept coming back. We now persist the dismissal
 * inside `User.hostProfileJson` (a JSON string column that already carries
 * accountSettings), so "closed once = closed forever" across reloads, logouts
 * and devices. No schema migration required.
 *
 * Pure functions (no `@/` / Prisma imports) so they're unit-testable.
 */
export type BannerKey = "accountActivated" | "completionCard";

export type DismissedBanners = {
  accountActivated?: boolean;
  completionCard?: boolean;
};

function parseJsonObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Read the persisted dismissal flags from a hostProfileJson string. */
export function readDismissedBanners(hostProfileJson: string | null): DismissedBanners {
  const json = parseJsonObject(hostProfileJson);
  const d = json.dismissedBanners;
  if (!d || typeof d !== "object") return {};
  const rec = d as Record<string, unknown>;
  return {
    accountActivated: Boolean(rec.accountActivated),
    completionCard: Boolean(rec.completionCard),
  };
}

/**
 * Set a banner's dismissed flag inside a hostProfileJson string and return the
 * new serialized JSON — preserving every other field already stored.
 */
export function applyBannerDismissal(hostProfileJson: string | null, banner: BannerKey): string {
  const json = parseJsonObject(hostProfileJson);
  const existing =
    json.dismissedBanners && typeof json.dismissedBanners === "object"
      ? (json.dismissedBanners as Record<string, unknown>)
      : {};
  json.dismissedBanners = { ...existing, [banner]: true };
  return JSON.stringify(json);
}
