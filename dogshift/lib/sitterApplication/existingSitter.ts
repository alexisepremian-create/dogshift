import { prisma } from "../prisma.ts";

/**
 * Returns true when the supplied identifier resolves to a DogShift user who is
 * an **activated** dog-sitter (service provider). We intentionally ignore
 * legacy artefacts (a dangling `SitterProfile` row that never made it past
 * `application_received`, or a `role = SITTER` assignment without a matching
 * active profile) to avoid blocking dog owners who once started an onboarding
 * but never got live.
 *
 * A user is considered an active sitter when their `SitterProfile` is any of:
 *   - `published = true`, OR
 *   - has a non-null `activatedAt`, OR
 *   - has `lifecycleStatus = "activated"`.
 */

type SitterProfileShape = {
  id: string;
  published?: boolean | null;
  activatedAt?: Date | null;
  lifecycleStatus?: string | null;
};

type UserShape = {
  role?: unknown;
  sitterProfile: SitterProfileShape | null | undefined;
};

export function normalizeApplicationEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isSitterRecord(user: UserShape | null | undefined): boolean {
  if (!user) return false;
  const profile = user.sitterProfile;
  if (!profile) return false;
  if (profile.published === true) return true;
  if (profile.activatedAt) return true;
  if (profile.lifecycleStatus === "activated") return true;
  return false;
}

const SITTER_PROFILE_SELECT = {
  select: {
    id: true,
    published: true,
    activatedAt: true,
    lifecycleStatus: true,
  },
} as const;

export async function emailBelongsToExistingSitter(
  email: string,
): Promise<boolean> {
  const normalized = normalizeApplicationEmail(email);
  if (!normalized) return false;
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      role: true,
      sitterProfile: SITTER_PROFILE_SELECT,
    },
  });
  return isSitterRecord(user);
}

export async function clerkUserIsExistingSitter(
  clerkUserId: string,
): Promise<{ isSitter: boolean; email: string | null }> {
  const trimmed = clerkUserId.trim();
  if (!trimmed) return { isSitter: false, email: null };
  const user = await prisma.user.findUnique({
    where: { clerkUserId: trimmed },
    select: {
      id: true,
      role: true,
      email: true,
      sitterProfile: SITTER_PROFILE_SELECT,
    },
  });
  return {
    isSitter: isSitterRecord(user),
    email: user?.email ?? null,
  };
}
