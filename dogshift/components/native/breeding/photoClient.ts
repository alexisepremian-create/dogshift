"use client";

/** Client helpers for the mating-profile photo gallery. */

export type PhotoItem = { key: string; url: string };

const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Upload one image to R2 via the existing dog-photo presign flow and return its
 * object key (keys live under `dog-photos/{userId}/`, reused for mating photos).
 */
export async function uploadBreedingPhoto(file: File): Promise<string> {
  const contentType = MIME_OK.has(file.type) ? file.type : "image/jpeg";
  const presignRes = await fetch("/api/account/dogs/photo/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, sizeBytes: file.size }),
  });
  const presign = (await presignRes.json().catch(() => null)) as { ok?: boolean; key?: string; uploadUrl?: string } | null;
  if (!presignRes.ok || !presign?.ok || !presign.key || !presign.uploadUrl) {
    throw new Error("PRESIGN_FAILED");
  }
  const put = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
  if (!put.ok) throw new Error("UPLOAD_FAILED");
  return presign.key;
}

/** Persist the ordered gallery for a dog and get back the resolved {key,url} items. */
export async function saveBreedingPhotos(dogProfileId: string, keys: string[]): Promise<PhotoItem[]> {
  const res = await fetch("/api/breeding/photos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dogProfileId, photos: keys }),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; photos?: PhotoItem[] } | null;
  if (!res.ok || !data?.ok) throw new Error("SAVE_FAILED");
  return data.photos ?? [];
}
