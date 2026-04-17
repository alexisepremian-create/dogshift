/**
 * Sitter profile avatars are stored in R2 under sitter-avatars/{sitterId}/...
 * Public delivery uses a first-party path that redirects to a short-lived presigned GET.
 */

const PREFIX = "sitter-avatars/";

export function sitterAvatarObjectPrefix(sitterId: string) {
  const id = typeof sitterId === "string" ? sitterId.trim() : "";
  return `${PREFIX}${id}/`;
}

export function encodeAvatarKeyToToken(key: string) {
  const k = typeof key === "string" ? key.trim() : "";
  if (!k) return "";
  return Buffer.from(k, "utf8").toString("base64url");
}

export function decodeAvatarTokenToKey(token: string) {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return null;
  try {
    return Buffer.from(t, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function publicAvatarMediaPath(key: string) {
  const token = encodeAvatarKeyToToken(key);
  if (!token) return "";
  return `/api/media/sitter-avatar/${token}`;
}

export function isSitterAvatarR2Key(key: string) {
  return typeof key === "string" && key.startsWith(PREFIX);
}

export function isPersistedAvatarMediaPath(value: string | null | undefined) {
  const v = typeof value === "string" ? value.trim() : "";
  return v.startsWith("/api/media/sitter-avatar/");
}
