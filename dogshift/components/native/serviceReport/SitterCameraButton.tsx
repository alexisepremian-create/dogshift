"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

import { fetchCurrentService, uploadReportPhoto } from "./reportClient";

/**
 * Camera button hosted in the homepage search bar — sitters only.
 * One tap: find the sitter's live service, open the device camera, and attach
 * the photo straight to that service's report. If nothing is live, we route the
 * sitter to guidance instead of silently failing.
 *
 * Gated on the same `ds_is_sitter` localStorage flag as the native menu, so it
 * never renders (and never fetches) for owners.
 */
export default function SitterCameraButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isSitter, setIsSitter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const bookingIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      setIsSitter(window.localStorage.getItem("ds_is_sitter") === "1");
    } catch {
      setIsSitter(false);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  if (!isSitter) return null;

  const openCamera = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const service = await fetchCurrentService();
      if (!service?.bookingId) {
        setToast("Aucune balade en cours");
        return;
      }
      bookingIdRef.current = service.bookingId;
      inputRef.current?.click();
    } catch {
      setToast("Réessaie dans un instant");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    const bookingId = bookingIdRef.current;
    if (!file || !bookingId) return;
    setBusy(true);
    setToast("Envoi de la photo…");
    try {
      await uploadReportPhoto(bookingId, file);
      setToast("Photo ajoutée au rapport ✓");
    } catch {
      setToast("Échec de l'envoi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openCamera}
        aria-label="Prendre une photo pour le rapport"
        aria-busy={busy}
        style={{ touchAction: "manipulation" }}
        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)] active:scale-95"
      >
        <Camera className="h-5 w-5" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        className="hidden"
        aria-hidden="true"
      />
      {toast ? (
        <div
          className="fixed left-1/2 z-[1600] -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
          role="status"
          onClick={() => bookingIdRef.current && router.push(`/rapport/${bookingIdRef.current}`)}
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
