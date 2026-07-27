/**
 * `User.role` vs "is this user a sitter?".
 *
 * Audit 2026-07-27. `role: "SITTER"` was only ever written by
 * `/api/become-sitter/apply` and the admin-only `/api/role/make-sitter`.
 * Activation (`POST /api/host/activation-code`) flipped
 * `SitterProfile.lifecycleStatus` to `activated` but never touched the role, so
 * any sitter onboarded through another path stayed `OWNER` forever.
 *
 * Real-user impact (Sonia Bürer, published sitter, `role = OWNER`): the contract
 * amendment modal never rendered for her, the admin panel linked her to
 * `/admin/owners/…` instead of her sitter file, and she was never redirected out
 * of the become-sitter application form.
 *
 * Two rules follow, and this module owns both:
 *
 *  1. **Activation promotes the role.** `promoteUserToSitterRole()` is called
 *     wherever a user becomes a sitter.
 *  2. **Authorization never trusts the role alone.** `hasSitterSide()` is the
 *     canonical read — an activated `SitterProfile` makes you a sitter whatever
 *     the role column says. Use it instead of `role === "SITTER"`.
 */

export type RoleLike = string | null | undefined;

/**
 * True when the user owns a sitter side that is live.
 *
 * Deliberately permissive on `role` and strict on the profile: the profile is
 * the artefact the onboarding flow actually maintains, the role column is the
 * one that drifted. Mirrors `isSitterRecord()` in
 * `lib/sitterApplication/existingSitter.ts`, which predates this module and
 * covers the application-side lookups.
 */
export function hasSitterSide(input: {
  role?: RoleLike;
  sitterId?: string | null;
  sitterProfile?: {
    published?: boolean | null;
    activatedAt?: Date | string | null;
    lifecycleStatus?: string | null;
  } | null;
}): boolean {
  if (input.role === "SITTER" && typeof input.sitterId === "string" && input.sitterId.length > 0) {
    return true;
  }
  const profile = input.sitterProfile;
  if (!profile) return false;
  if (profile.published === true) return true;
  if (profile.activatedAt) return true;
  return profile.lifecycleStatus === "activated";
}

/**
 * Prisma `where` fragment matching the same users `hasSitterSide()` accepts.
 *
 * Kept next to `hasSitterSide()` on purpose: the two must stay in sync, and a
 * silent divergence would make an admin filter disagree with the badge rendered
 * on the very same row.
 */
export function sitterSideWhere() {
  return {
    OR: [
      { role: "SITTER" as const, sitterId: { not: null } },
      { sitterProfile: { published: true } },
      { sitterProfile: { activatedAt: { not: null } } },
      { sitterProfile: { lifecycleStatus: "activated" as const } },
    ],
  };
}

type PrismaLike = {
  user: {
    updateMany: (args: {
      where: { id: string; role: "OWNER" };
      data: { role: "SITTER" };
    }) => Promise<{ count: number }>;
  };
};

/**
 * Promote a user to `role: "SITTER"`.
 *
 * Scoped to `role: "OWNER"` via `updateMany` so it is both idempotent and unable
 * to demote an ADMIN — `updateMany` matches zero rows instead of throwing when
 * the user is already a SITTER or is an ADMIN.
 *
 * Returns true when a row was actually promoted.
 */
export async function promoteUserToSitterRole(prisma: PrismaLike, userId: string): Promise<boolean> {
  const id = String(userId ?? "").trim();
  if (!id) return false;
  const { count } = await prisma.user.updateMany({
    where: { id, role: "OWNER" },
    data: { role: "SITTER" },
  });
  return count > 0;
}
