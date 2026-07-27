import { isDogPhotoR2Key } from "@/lib/dogPhotoMedia";

/** Max photos on one listing — matches `photoKeys` in lib/validators/adoption.ts. */
export const MAX_LISTING_PHOTOS = 12;

/**
 * Listing photos reuse the `dog-photos/<userId>/` R2 prefix (same presign
 * route as dog profile photos). Re-checking the owner segment on every write is
 * the only server-side gate that stops a cédant from attaching another user's
 * private dog photo to their public ad — see the "File uploads" rule in
 * CLAUDE.md: the prefix check on commit is load-bearing, never skip it.
 */
export function isOwnedDogPhotoKey(key: string, userId: string): boolean {
  return isDogPhotoR2Key(key) && key.startsWith(`dog-photos/${userId}/`);
}
