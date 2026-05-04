const PREFIX = "dog-photos/";

export function encodeDogPhotoKeyToToken(key: string) {
  const k = typeof key === "string" ? key.trim() : "";
  if (!k) return "";
  return Buffer.from(k, "utf8").toString("base64url");
}

export function decodeDogPhotoTokenToKey(token: string) {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return null;
  try {
    return Buffer.from(t, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function publicDogPhotoPath(key: string) {
  const token = encodeDogPhotoKeyToToken(key);
  if (!token) return "";
  return `/api/media/dog-photo/${token}`;
}

export function isDogPhotoR2Key(key: string) {
  return typeof key === "string" && key.startsWith(PREFIX);
}
