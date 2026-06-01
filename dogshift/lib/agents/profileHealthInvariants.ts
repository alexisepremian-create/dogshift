/**
 * Profile health invariants.
 *
 * Pure-function checks against a (User, SitterProfile?) pair. Each invariant
 * has a stable ID (used in the AuditLog metadata + the Telegram recap),
 * a severity (drives sort order + emoji), an `autoFixable` flag (the cron
 * applies safe fixes immediately) and a human-readable message.
 *
 * Adding a new check : append to INVARIANTS. Tests in
 * `tests/integrations/profileHealthInvariants.test.ts` lock the contract
 * — each new entry must come with a fixture pass/fail case.
 */

import { CURRENT_TERMS_VERSION } from "../terms.ts";
import { computeSitterProfileCompletionDetails } from "../sitterCompletion.ts";

export type Severity = "high" | "medium" | "low";

export type Invariant = {
  id: string;
  message: string;
  severity: Severity;
  autoFixable: boolean;
};

export type ProfileHealthIssue = Invariant & {
  userId: string;
  targetEmail: string | null;
  targetName: string | null;
  // Filled when autoFixable is true and the cron has applied the fix.
  fixed?: boolean;
  fixDetails?: Record<string, unknown>;
};

// ── Input shape ──────────────────────────────────────────────────────────────
//
// We deliberately accept a "loose" shape rather than full Prisma types so the
// pure checks stay decoupled from the schema's per-version changes — a column
// rename in SitterProfile shouldn't force this file to be re-typed.

export type ProfileSnapshot = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role: string;
    sitterId: string | null;
    hostProfileJson: unknown;
  };
  sitterProfile: {
    id: string;
    sitterId: string;
    published: boolean;
    lifecycleStatus: string;
    verificationStatus: string;
    stripeAccountStatus: string | null;
    termsAcceptedAt: Date | null;
    termsVersion: string | null;
    services: unknown;
    dogSizes: unknown;
    pricing: unknown;
    avatarUrl: string | null;
    profileCompletion?: number | null;
    city: string | null;
    displayName: string | null;
    bio: string | null;
  } | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function asBooleanRecord(value: unknown, expectedKeys: readonly string[]): Record<string, boolean> {
  // hostProfileJson stores services/dogSizes as a boolean record
  //   { Promenade: true, ... } or { Small: true, ... }
  // SitterProfile.services stores them as an array of names instead. Same
  // semantic, different shapes. We project both into the same boolean record
  // for direct comparison.
  const out: Record<string, boolean> = {};
  for (const k of expectedKeys) out[k] = false;
  if (Array.isArray(value)) {
    for (const v of value) if (typeof v === "string" && v in out) out[v] = true;
    return out;
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of expectedKeys) {
      const v = o[key];
      out[key] = v === true;
    }
  }
  return out;
}

const SERVICE_KEYS = ["Promenade", "Garde", "Pension"] as const;
const DOG_SIZE_KEYS = ["Small", "Medium", "Large"] as const;

function recordsDiffer(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? false) !== (b[k] ?? false)) return true;
  }
  return false;
}

function getJsonField<T>(json: unknown, key: string): T | undefined {
  if (!json || typeof json !== "object") return undefined;
  return (json as Record<string, unknown>)[key] as T | undefined;
}

// ── Invariant runners ────────────────────────────────────────────────────────
//
// Each runner takes a snapshot and either returns a ProfileHealthIssue (the
// invariant fired) or null (passed). They're explicit functions rather than
// a table of predicates so the messages can interpolate the exact failing
// values, which matters when the maintenance-recap Telegram shows them.

type Runner = (snap: ProfileSnapshot) => ProfileHealthIssue | null;

function issue(
  snap: ProfileSnapshot,
  inv: Invariant,
  message?: string,
): ProfileHealthIssue {
  return {
    ...inv,
    message: message ?? inv.message,
    userId: snap.user.id,
    targetEmail: snap.user.email,
    targetName: snap.user.name,
  };
}

export const RUNNERS: readonly Runner[] = [
  // 1. TERMS_MISSING_BUT_PUBLISHED — exactly the Sonia case.
  (snap) => {
    const sp = snap.sitterProfile;
    if (!sp) return null;
    if (!sp.published) return null;
    if (sp.termsAcceptedAt && sp.termsVersion === CURRENT_TERMS_VERSION) return null;
    return issue(snap, {
      id: "TERMS_MISSING_BUT_PUBLISHED",
      severity: "high",
      autoFixable: false,
      message: `Profil publié mais CGU non acceptées (termsAcceptedAt=${sp.termsAcceptedAt ? "ok" : "null"}, version=${sp.termsVersion ?? "null"})`,
    });
  },

  // 2. TERMS_OUTDATED — accepted an older version, not currently blocking
  // publish but should re-prompt at next admin pass.
  (snap) => {
    const sp = snap.sitterProfile;
    if (!sp || !sp.termsAcceptedAt) return null;
    if (sp.termsVersion === CURRENT_TERMS_VERSION) return null;
    return issue(snap, {
      id: "TERMS_OUTDATED",
      severity: "medium",
      autoFixable: false,
      message: `CGU acceptées mais version périmée (stored=${sp.termsVersion ?? "null"}, current=${CURRENT_TERMS_VERSION})`,
    });
  },

  // 3. STRIPE_NOT_ENABLED_BUT_PUBLISHED — payouts would fail.
  (snap) => {
    const sp = snap.sitterProfile;
    if (!sp || !sp.published) return null;
    if (sp.stripeAccountStatus === "ENABLED") return null;
    return issue(snap, {
      id: "STRIPE_NOT_ENABLED_BUT_PUBLISHED",
      severity: "high",
      autoFixable: false,
      message: `Profil publié mais Stripe Connect status=${sp.stripeAccountStatus ?? "null"} (attendu ENABLED)`,
    });
  },

  // 4. LIFECYCLE_MISMATCH_PUBLISHED — shouldn't be reachable through the UI
  // but the DB can drift.
  (snap) => {
    const sp = snap.sitterProfile;
    if (!sp || !sp.published) return null;
    if (sp.lifecycleStatus === "activated") return null;
    return issue(snap, {
      id: "LIFECYCLE_MISMATCH_PUBLISHED",
      severity: "high",
      autoFixable: false,
      message: `Profil publié mais lifecycleStatus=${sp.lifecycleStatus} (attendu "activated")`,
    });
  },

  // 5. VERIFICATION_NOT_APPROVED_PUBLISHED
  (snap) => {
    const sp = snap.sitterProfile;
    if (!sp || !sp.published) return null;
    if (sp.verificationStatus === "approved") return null;
    return issue(snap, {
      id: "VERIFICATION_NOT_APPROVED_PUBLISHED",
      severity: "high",
      autoFixable: false,
      message: `Profil publié mais verificationStatus=${sp.verificationStatus} (attendu "approved")`,
    });
  },

  // 6. COMPLETION_CACHE_STALE — safe auto-fix : recompute the cached value.
  (snap) => {
    const sp = snap.sitterProfile;
    if (!sp || sp.profileCompletion == null) return null;
    const recomputed = computeSitterProfileCompletionDetails({
      avatarUrl: sp.avatarUrl,
      firstName: sp.displayName?.split(" ")[0] ?? null,
      city: sp.city,
      address: getJsonField(snap.user.hostProfileJson, "address"),
      bio: sp.bio,
      services: sp.services,
      pricing: sp.pricing,
      dogSizes: sp.dogSizes,
      stripeAccountStatus: sp.stripeAccountStatus,
    }).percent;
    if (recomputed === sp.profileCompletion) return null;
    return issue(snap, {
      id: "COMPLETION_CACHE_STALE",
      severity: "low",
      autoFixable: true,
      message: `profileCompletion cache=${sp.profileCompletion} mais recomputed=${recomputed}`,
    });
  },

  // 7. SERVICES_DESYNC — hostProfileJson.services vs SitterProfile.services
  // (the dual-source bug). Auto-fix : align hostProfileJson with the
  // canonical SitterProfile column.
  (snap) => {
    const sp = snap.sitterProfile;
    if (!sp) return null;
    const canonical = asBooleanRecord(sp.services, SERVICE_KEYS);
    const mirror = asBooleanRecord(getJsonField(snap.user.hostProfileJson, "services"), SERVICE_KEYS);
    if (!recordsDiffer(canonical, mirror)) return null;
    return issue(snap, {
      id: "SERVICES_DESYNC",
      severity: "medium",
      autoFixable: true,
      message: `services divergent entre hostProfileJson et SitterProfile (canonical=${JSON.stringify(canonical)})`,
    });
  },

  // 8. DOG_SIZES_DESYNC — same pattern, same fix.
  (snap) => {
    const sp = snap.sitterProfile;
    if (!sp) return null;
    const canonical = asBooleanRecord(sp.dogSizes, DOG_SIZE_KEYS);
    const mirror = asBooleanRecord(getJsonField(snap.user.hostProfileJson, "dogSizes"), DOG_SIZE_KEYS);
    if (!recordsDiffer(canonical, mirror)) return null;
    return issue(snap, {
      id: "DOG_SIZES_DESYNC",
      severity: "medium",
      autoFixable: true,
      message: `dogSizes divergent entre hostProfileJson et SitterProfile`,
    });
  },

  // 9. SITTER_PROFILE_ORPHAN — user marked as sitter but no profile row.
  (snap) => {
    if (!snap.user.sitterId) return null;
    if (snap.sitterProfile) return null;
    return issue(snap, {
      id: "SITTER_PROFILE_ORPHAN",
      severity: "high",
      autoFixable: false,
      message: `User.sitterId=${snap.user.sitterId} mais aucun SitterProfile lié`,
    });
  },

  // 10. EMAIL_MISSING — fundamental data integrity check.
  (snap) => {
    if (snap.user.email && snap.user.email.trim().length > 0) return null;
    return issue(snap, {
      id: "EMAIL_MISSING",
      severity: "high",
      autoFixable: false,
      message: `User.email vide ou null`,
    });
  },
];

export function runProfileHealthChecks(snap: ProfileSnapshot): ProfileHealthIssue[] {
  const out: ProfileHealthIssue[] = [];
  for (const runner of RUNNERS) {
    const result = runner(snap);
    if (result) out.push(result);
  }
  return out;
}

// ── Auto-fix planner ─────────────────────────────────────────────────────────
//
// Given an issue marked autoFixable, returns the Prisma update payload that
// would resolve it. Returns null if not applicable. The cron orchestrator
// applies the update + writes an AuditLog row.

export type AutoFixPlan =
  | { table: "sitterProfile"; where: { id: string }; data: Record<string, unknown> }
  | { table: "user"; where: { id: string }; data: Record<string, unknown> };

export function planAutoFix(
  issue: ProfileHealthIssue,
  snap: ProfileSnapshot,
): AutoFixPlan | null {
  if (!issue.autoFixable) return null;
  const sp = snap.sitterProfile;

  if (issue.id === "COMPLETION_CACHE_STALE" && sp) {
    const recomputed = computeSitterProfileCompletionDetails({
      avatarUrl: sp.avatarUrl,
      firstName: sp.displayName?.split(" ")[0] ?? null,
      city: sp.city,
      address: getJsonField(snap.user.hostProfileJson, "address"),
      bio: sp.bio,
      services: sp.services,
      pricing: sp.pricing,
      dogSizes: sp.dogSizes,
      stripeAccountStatus: sp.stripeAccountStatus,
    }).percent;
    return {
      table: "sitterProfile",
      where: { id: sp.id },
      data: { profileCompletion: recomputed },
    };
  }

  if (issue.id === "SERVICES_DESYNC" && sp) {
    const canonical = asBooleanRecord(sp.services, SERVICE_KEYS);
    const newHostJson = {
      ...(typeof snap.user.hostProfileJson === "object" && snap.user.hostProfileJson !== null
        ? (snap.user.hostProfileJson as Record<string, unknown>)
        : {}),
      services: canonical,
    };
    return {
      table: "user",
      where: { id: snap.user.id },
      data: { hostProfileJson: newHostJson },
    };
  }

  if (issue.id === "DOG_SIZES_DESYNC" && sp) {
    const canonical = asBooleanRecord(sp.dogSizes, DOG_SIZE_KEYS);
    const newHostJson = {
      ...(typeof snap.user.hostProfileJson === "object" && snap.user.hostProfileJson !== null
        ? (snap.user.hostProfileJson as Record<string, unknown>)
        : {}),
      dogSizes: canonical,
    };
    return {
      table: "user",
      where: { id: snap.user.id },
      data: { hostProfileJson: newHostJson },
    };
  }

  return null;
}
