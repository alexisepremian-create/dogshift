/**
 * The service-activation ↔ availability invariant.
 *
 * `ServiceConfig.enabled` is the single source of truth for "does this sitter
 * offer this service?". `SitterProfile.services` and
 * `User.hostProfileJson.services` are mirrors kept in sync by
 * `lib/sitter/serviceSync.ts`.
 *
 * Two rules follow from that, and this module owns both:
 *
 *  1. **You cannot set availability for a service you have not activated.**
 *     Otherwise a sitter spends time filling a calendar that the slot engine
 *     ignores (`computeDaySlots` returns `[]` when `config.enabled === false`).
 *
 *  2. **An activated service with zero availability is not bookable**, so it
 *     must not be advertised publicly. Otherwise an owner opens the fiche,
 *     sees "Pension", and every single date comes back UNAVAILABLE — the
 *     exact complaint that triggered this module.
 */

// Relative (not `@/`) so the node test runner can resolve it — tests/ runs
// without the tsconfig path aliases.
import { SERVICE_DEFAULTS, type ServiceType } from "./slotEngine.ts";

export const SERVICE_TYPES: ServiceType[] = ["PROMENADE", "DOGSITTING", "PENSION"];

/**
 * A missing `ServiceConfig` row means "never configured". The slot engine
 * treats that as enabled (`config?.enabled ?? true`), so we must too — any
 * other reading would silently un-publish legacy sitters.
 */
export function isServiceEnabled(row: { enabled?: boolean | null } | null | undefined): boolean {
  return row?.enabled !== false;
}

type PrismaLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceConfig: any;
};

/**
 * Resolve the activation state of one service, materializing the
 * `ServiceConfig` row if it is missing so later reads are unambiguous.
 *
 * Returns `false` when the sitter explicitly turned the service off.
 */
export async function ensureServiceConfigRow(
  prisma: PrismaLike,
  sitterId: string,
  serviceType: ServiceType,
): Promise<boolean> {
  const existing = await prisma.serviceConfig.findUnique({
    where: { sitterId_serviceType: { sitterId, serviceType } },
    select: { enabled: true },
  });
  if (existing) return isServiceEnabled(existing);

  await prisma.serviceConfig.create({
    data: { ...SERVICE_DEFAULTS[serviceType], sitterId, serviceType, enabled: true },
  });
  return true;
}

/** Thrown by `assertServiceEnabledOrThrow`; mapped to a 400 by the callers. */
export const SERVICE_DISABLED = "SERVICE_DISABLED";

export async function assertServiceEnabledOrThrow(
  prisma: PrismaLike,
  sitterId: string,
  serviceType: ServiceType,
): Promise<void> {
  const enabled = await ensureServiceConfigRow(prisma, sitterId, serviceType);
  if (!enabled) throw new Error(SERVICE_DISABLED);
}

type AvailabilityPrismaLike = {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  availabilityRule: any;
  availabilityException: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
};

/**
 * Rule 2: for each sitter, which services have at least one usable slot source?
 *
 * A service with zero recurring rules AND zero upcoming exceptions produces
 * `UNAVAILABLE` for every date the owner can pick, so advertising it on the
 * public fiche is a dead end. Batched (two `groupBy`s) so the homepage can call
 * it for a whole page of sitters without N+1.
 */
export async function loadBookableServiceTypes(
  prisma: AvailabilityPrismaLike,
  sitterIds: string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const ids = sitterIds.map((id) => String(id ?? "").trim()).filter(Boolean);
  if (ids.length === 0) return out;

  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const [rules, exceptions] = await Promise.all([
    prisma.availabilityRule.groupBy({
      by: ["sitterId", "serviceType"],
      where: { sitterId: { in: ids }, status: { in: ["AVAILABLE", "ON_REQUEST"] } },
    }),
    prisma.availabilityException.groupBy({
      by: ["sitterId", "serviceType"],
      where: { sitterId: { in: ids }, status: { in: ["AVAILABLE", "ON_REQUEST"] }, date: { gte: todayUtc } },
    }),
  ]);

  for (const row of [...(rules ?? []), ...(exceptions ?? [])]) {
    const sitterId = String(row?.sitterId ?? "").trim();
    const serviceType = String(row?.serviceType ?? "").trim();
    if (!sitterId || !serviceType) continue;
    const set = out.get(sitterId) ?? new Set<string>();
    set.add(serviceType);
    out.set(sitterId, set);
  }

  return out;
}
