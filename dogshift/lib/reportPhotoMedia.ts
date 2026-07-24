// Service-report photo media helpers — mirror of lib/dogPhotoMedia.ts for the
// `report-photos/` R2 prefix. base64url token ⇄ R2 key, served via a redirect
// route so the key is never exposed and email clients can fetch the image.
const PREFIX = "report-photos/";

function toBase64Url(str: string): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(str, "utf8").toString("base64")
      : btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1: string) => String.fromCharCode(parseInt(p1, 16))));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(token: string): string {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  return decodeURIComponent(
    Array.from(atob(padded))
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
}

export function encodeReportPhotoKeyToToken(key: string) {
  const k = typeof key === "string" ? key.trim() : "";
  if (!k) return "";
  return toBase64Url(k);
}

export function decodeReportPhotoTokenToKey(token: string) {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return null;
  try {
    return fromBase64Url(t);
  } catch {
    return null;
  }
}

export function publicReportPhotoPath(key: string) {
  const token = encodeReportPhotoKeyToToken(key);
  if (!token) return "";
  return `/api/media/report-photo/${token}`;
}

export function isReportPhotoR2Key(key: string) {
  return typeof key === "string" && key.startsWith(PREFIX);
}

/** R2 key prefix for a given sitter + booking (the commit-time ownership gate). */
export function reportPhotoPrefix(sitterId: string, bookingId: string) {
  return `${PREFIX}${sitterId}/${bookingId}/`;
}
