/**
 * Cross-source sync for sitter services state.
 *
 * Audit 2026-06-08 (Layer 2 fix). DogShift had THREE sources of truth for
 * "which services does this sitter offer?":
 *
 *   1. `ServiceConfig.{*}.enabled` — per-sitter, per-serviceType rows.
 *      Drives the booking flow (slot engine reads this directly).
 *   2. `SitterProfile.services` — array of UI labels stored on the profile
 *      column. Drives the public sitter page + search filters.
 *   3. `User.hostProfileJson.services` — boolean record stored in the
 *      dashboard's JSON blob. Drives the edit form state.
 *
 * Each endpoint historically wrote to only a subset:
 *
 *   - `PUT /api/sitters/me/service-config` writes (1)            → (2),(3) stale
 *   - `POST /api/host/profile`             writes (2),(3)        → (1) stale
 *   - `POST /api/host/profile/pricing`     writes nothing here    → ok
 *
 * Real-user impact: 15 sitters surfaced in the 2026-06-08 profile-health
 * recap as "services désynchronisés (UI vs base)". An owner could see
 * "Garde disponible" while the booking engine refused the slot because
 * `ServiceConfig.DOGSITTING.enabled = false`.
 *
 * This module exposes a single helper, `syncSitterServices()`, that every
 * write path can call to atomically align all three sources from the
 * provided canonical state.
 */

import type { PrismaClient } from "@prisma/client";

import type { Prisma } from "@prisma/client";

/** UI labels used by SitterProfile.services + the dashboard. */
export const UI_SERVICE_LABELS = ["Promenade", "Garde", "Pension"] as const;
export type UiServiceLabel = (typeof UI_SERVICE_LABELS)[number];

/** Prisma ServiceType enum values used by ServiceConfig. */
export const SERVICE_TYPE_ENUM = ["PROMENADE", "DOGSITTING", "PENSION"] as const;
export type ServiceTypeEnum = (typeof SERVICE_TYPE_ENUM)[number];

const ENUM_BY_UI_LABEL: Record<UiServiceLabel, ServiceTypeEnum> = {
  Promenade: "PROMENADE",
  Garde: "DOGSITTING",
  Pension: "PENSION",
};

/**
 * Normalize any shape we encounter in production into the canonical
 * boolean record `{ Promenade, Garde, Pension }`. Tolerates:
 *
 *   - array of UI labels: `["Promenade", "Garde"]`
 *   - boolean record:     `{ Promenade: true, Garde: true, Pension: false }`
 *   - mixed garbage:      anything else → all false
 *
 * The contract is intentionally permissive on read so legacy data heals on
 * the next write. New writes must always emit a clean boolean record.
 */
export function normalizeServicesToBoolRecord(value: unknown): Record<UiServiceLabel, boolean> {
  const out: Record<UiServiceLabel, boolean> = { Promenade: false, Garde: false, Pension: false };
  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === "string") {
        const trimmed = v.trim() as UiServiceLabel;
        if (UI_SERVICE_LABELS.includes(trimmed)) {
          out[trimmed] = true;
        }
      }
    }
    return out;
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const label of UI_SERVICE_LABELS) {
      if (o[label] === true) out[label] = true;
    }
  }
  return out;
}

/** Convert a boolean record into the legacy array shape stored on `SitterProfile.services`. */
export function toServicesArray(record: Record<UiServiceLabel, boolean>): UiServiceLabel[] {
  return UI_SERVICE_LABELS.filter((label) => record[label] === true);
}

/**
 * Merge the boolean record into the JSON blob without dropping unrelated
 * fields. Returns the updated JSON ready to be `JSON.stringify`ed.
 */
export function mergeServicesIntoHostJson(
  rawHostJson: string | null | undefined,
  record: Record<UiServiceLabel, boolean>,
): Record<string, unknown> {
  let base: Record<string, unknown> = {};
  if (typeof rawHostJson === "string" && rawHostJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawHostJson);
      if (parsed && typeof parsed === "object") base = parsed as Record<string, unknown>;
    } catch {
      // corrupted JSON — start fresh, don't lose the new state
    }
  }
  base.services = { ...record };
  base.updatedAt = new Date().toISOString();
  return base;
}

export type SyncSitterServicesInput = {
  /** Required to update SitterProfile + ServiceConfig FK. */
  sitterId: string;
  /** Required to update User.hostProfileJson. */
  userId: string;
  /**
   * Canonical state to enforce across all three sources. Pass whatever
   * shape you have — it will be normalized.
   */
  services: unknown;
};

export type SyncSitterServicesResult = {
  /** The canonical boolean record actually written. */
  canonical: Record<UiServiceLabel, boolean>;
  /** Number of ServiceConfig rows upserted (always 3 — one per UI label). */
  serviceConfigsUpserted: number;
  /** Did SitterProfile.services need an actual write? */
  sitterProfileUpdated: boolean;
  /** Did User.hostProfileJson need an actual write? */
  hostProfileJsonUpdated: boolean;
};

/**
 * Atomically align all three sources to the provided canonical state.
 *
 * Runs inside an interactive Prisma transaction (single round-trip on
 * commit) so concurrent writers can't observe a half-synced state.
 *
 * Idempotent: calling twice in a row with the same input is a no-op
 * besides incrementing the row's `updatedAt`.
 *
 * Does NOT throw on a missing row — the caller is expected to have
 * verified the sitter exists (POST handlers do this already).
 */
export async function syncSitterServices(
  prisma: PrismaClient,
  input: SyncSitterServicesInput,
): Promise<SyncSitterServicesResult> {
  const canonical = normalizeServicesToBoolRecord(input.services);
  const asArray = toServicesArray(canonical);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  return prisma.$transaction(async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txAny = tx as any;

    // ── ServiceConfig (1) ──────────────────────────────────────────────
    let serviceConfigsUpserted = 0;
    for (const label of UI_SERVICE_LABELS) {
      const serviceType = ENUM_BY_UI_LABEL[label];
      await txAny.serviceConfig.upsert({
        where: { sitterId_serviceType: { sitterId: input.sitterId, serviceType } },
        create: { sitterId: input.sitterId, serviceType, enabled: canonical[label] },
        update: { enabled: canonical[label] },
      });
      serviceConfigsUpserted++;
    }

    // ── SitterProfile.services (2) ─────────────────────────────────────
    const existing = await txAny.sitterProfile.findUnique({
      where: { sitterId: input.sitterId },
      select: { services: true },
    });
    const existingArray = Array.isArray(existing?.services)
      ? (existing.services as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    const sortedExisting = [...existingArray].sort();
    const sortedNext = [...asArray].sort();
    const sitterProfileUpdated =
      sortedExisting.length !== sortedNext.length ||
      sortedExisting.some((v, i) => v !== sortedNext[i]);
    if (sitterProfileUpdated) {
      await txAny.sitterProfile.update({
        where: { sitterId: input.sitterId },
        data: { services: asArray as Prisma.InputJsonValue },
        select: { id: true },
      });
    }

    // ── User.hostProfileJson.services (3) ──────────────────────────────
    const userRow = await tx.user.findUnique({
      where: { id: input.userId },
      select: { hostProfileJson: true } as unknown as Record<string, true>,
    });
    const rawJson = (userRow as unknown as { hostProfileJson?: string | null })?.hostProfileJson ?? null;
    const merged = mergeServicesIntoHostJson(rawJson, canonical);
    const mergedSerialized = JSON.stringify(merged);
    const hostProfileJsonUpdated = mergedSerialized !== rawJson;
    if (hostProfileJsonUpdated) {
      await tx.user.update({
        where: { id: input.userId },
        data: { hostProfileJson: mergedSerialized } as unknown as Record<string, unknown>,
      });
    }

    void db; // touched to satisfy unused-vars when outer cast not used
    return {
      canonical,
      serviceConfigsUpserted,
      sitterProfileUpdated,
      hostProfileJsonUpdated,
    };
  });
}
