/**
 * Pure helpers for match access + message previews. No `@/` imports so they run
 * under `node --test`.
 */

/** A user participates in a match iff they own one of the two matched dogs. */
export function isMatchParticipant(
  match: { dogA: { userId: string }; dogB: { userId: string } },
  userId: string,
): boolean {
  return match.dogA.userId === userId || match.dogB.userId === userId;
}

/** Given a match and my user id, return the OTHER side (my counterpart). */
export function otherSide<T extends { userId: string }>(
  match: { dogA: T; dogB: T },
  userId: string,
): T {
  return match.dogA.userId === userId ? match.dogB : match.dogA;
}

/** Short single-line preview for a thread's last message. */
export function previewOf(body: string, max = 80): string {
  const t = body.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
