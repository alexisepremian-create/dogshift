const PREFIX = "dog-photos/";

/** base64url encode — works in both Node.js and browser (webpack polyfill) */
function toBase64Url(str: string): string {
  // Use standard base64 then convert to base64url (no Buffer.toString("base64url") — not in webpack polyfill)
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(str, "utf8").toString("base64")
      : btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1: string) => String.fromCharCode(parseInt(p1, 16))));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** base64url decode — works in both Node.js and browser */
function fromBase64Url(token: string): string {
  // Restore standard base64 padding
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  return decodeURIComponent(
    Array.from(atob(padded))
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function encodeDogPhotoKeyToToken(key: string) {
  const k = typeof key === "string" ? key.trim() : "";
  if (!k) return "";
  return toBase64Url(k);
}

export function decodeDogPhotoTokenToKey(token: string) {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return null;
  try {
    return fromBase64Url(t);
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
