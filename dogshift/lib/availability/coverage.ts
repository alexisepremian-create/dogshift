/**
 * Availability coverage: does a sitter have at least one bookable
 * (non-UNAVAILABLE) recurring rule for EVERY service they've enabled?
 *
 * A brand-new sitter's agenda is empty, so the slot engine reports every day
 * as UNAVAILABLE — a published-but-empty profile is invisible in search and
 * receives zero bookings. We use this to BLOCK first publish until the sitter
 * has set some availability, and to surface a clear "you're invisible" warning
 * to sitters who slipped through before this gate existed.
 *
 * `computeCoverage` is a pure function (unit-testable without Prisma);
 * `getSitterAvailabilityCoverage` is the DB-backed wrapper used by the publish
 * route and by getHostUserData.
 */
import type { ServiceType } from "@prisma/client";

export type AvailabilityCoverage = {
  /** Enabled services that have at least one non-UNAVAILABLE recurring rule. */
  servicesWithAvailability: ServiceType[];
  /** Enabled services with NO bookable availability (the blockers). */
  missing: ServiceType[];
  /** True when every enabled service has availability (and at least one service is enabled). */
  ok: boolean;
};

/**
 * Pure decision: given the enabled services and the set of service types that
 * have ≥1 bookable rule, split into covered vs missing.
 *
 * `ok` is false when there are no enabled services at all — a sitter with
 * nothing enabled has nothing to publish, so they must not pass the gate.
 */
export function computeCoverage(
  enabledServices: readonly ServiceType[],
  serviceTypesWithRules: Iterable<ServiceType>,
): AvailabilityCoverage {
  const withRules = new Set<ServiceType>(serviceTypesWithRules);
  const enabled = Array.from(new Set(enabledServices));

  const servicesWithAvailability = enabled.filter((s) => withRules.has(s));
  const missing = enabled.filter((s) => !withRules.has(s));

  return {
    servicesWithAvailability,
    missing,
    ok: enabled.length > 0 && missing.length === 0,
  };
}

/**
 * DB-backed coverage for a sitter. Reads the distinct service types that have
 * at least one recurring rule whose status is not UNAVAILABLE.
 */
export async function getSitterAvailabilityCoverage(
  sitterId: string,
  enabledServices: readonly ServiceType[],
): Promise<AvailabilityCoverage> {
  if (!sitterId || enabledServices.length === 0) {
    return { servicesWithAvailability: [], missing: [...enabledServices], ok: false };
  }

  // Lazy import keeps the pure `computeCoverage` unit-testable without pulling
  // Prisma (and the `@/` alias) into the module's load graph.
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.availabilityRule.findMany({
    where: { sitterId, status: { not: "UNAVAILABLE" } },
    select: { serviceType: true },
    distinct: ["serviceType"],
  });

  return computeCoverage(
    enabledServices,
    rows.map((r) => r.serviceType),
  );
}
