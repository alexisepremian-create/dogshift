"use client";

/** Client-side helpers for the service-report photo flow (presign → PUT → commit). */

export type UploadedPhoto = { id: string; url: string; caption: string | null };

const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Upload one photo file to a booking's report: presign an R2 PUT, upload the
 * bytes directly, then commit the key server-side. Returns the created photo.
 */
export async function uploadReportPhoto(bookingId: string, file: File): Promise<UploadedPhoto> {
  const contentType = MIME_OK.has(file.type) ? file.type : "image/jpeg";

  const presignRes = await fetch(`/api/host/bookings/${encodeURIComponent(bookingId)}/report/photos/presign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType, sizeBytes: file.size }),
  });
  const presign = await presignRes.json().catch(() => null);
  if (!presignRes.ok || !presign?.ok) {
    throw new Error(presign?.error || "PRESIGN_FAILED");
  }

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: file,
  });
  if (!put.ok) throw new Error("UPLOAD_FAILED");

  const commitRes = await fetch(`/api/host/bookings/${encodeURIComponent(bookingId)}/report/photos/commit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: presign.key, takenAt: new Date().toISOString() }),
  });
  const commit = await commitRes.json().catch(() => null);
  if (!commitRes.ok || !commit?.ok) {
    throw new Error(commit?.error || "COMMIT_FAILED");
  }
  return commit.photo as UploadedPhoto;
}

export type CurrentService = {
  bookingId: string;
  service: string | null;
  serviceType: string | null;
  dogName: string | null;
  reportId: string | null;
  reportStatus: string | null;
} | null;

/** The sitter's live service right now (for the camera quick-attach). */
export async function fetchCurrentService(): Promise<CurrentService> {
  const res = await fetch("/api/host/current-service", { headers: { accept: "application/json" } });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) return null;
  return (json.service ?? null) as CurrentService;
}
