import { prisma } from "../prisma.ts";

/**
 * Returns true when the supplied identifier resolves to a DogShift user who is
 * already a dog-sitter (service provider). We consider the user a sitter when
 * either:
 *   - a `SitterProfile` row exists for them, or
 *   - their `role` is `SITTER` (legacy activation path).
 *
 * Used to block already-activated sitters from submitting a new pilot
 * application (both client UX and server-side guard).
 */
export function normalizeApplicationEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isSitterRecord(
  user:
    | { role: unknown; sitterProfile: { id: string } | null | undefined }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  if (user.sitterProfile) return true;
  return user.role === "SITTER";
}

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
      sitterProfile: { select: { id: true } },
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
      sitterProfile: { select: { id: true } },
    },
  });
  return {
    isSitter: isSitterRecord(user),
    email: user?.email ?? null,
  };
}
