"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Send } from "lucide-react";

import { uploadReportPhoto, type UploadedPhoto } from "./reportClient";
import WalkTracker from "./WalkTracker";
import type { LatLng } from "@/lib/serviceReport/track";

type Mood = "HAPPY" | "CALM" | "TIRED" | "PLAYFUL" | "ANXIOUS";

type ReportState = {
  peed: boolean | null;
  pooed: boolean | null;
  drankWater: boolean | null;
  ate: boolean | null;
  played: boolean | null;
  mood: Mood | null;
  energy: number | null;
  note: string | null;
  incidents: string | null;
};

type LoadedReport = ReportState & {
  id: string;
  status: string;
  photos: UploadedPhoto[];
  routeJson: LatLng[] | null;
  distanceMeters: number | null;
};

type BookingCtx = {
  service: string | null;
  serviceType: string | null;
  startAt: string | null;
  endAt: string | null;
  startDate: string | null;
  endDate: string | null;
  dogName: string | null;
};

const CHECKLIST: { key: keyof Pick<ReportState, "peed" | "pooed" | "drankWater" | "ate" | "played">; label: string; emoji: string }[] = [
  { key: "peed", label: "Pipi", emoji: "💦" },
  { key: "pooed", label: "Caca", emoji: "💩" },
  { key: "drankWater", label: "Eau", emoji: "🚰" },
  { key: "ate", label: "Repas", emoji: "🍖" },
  { key: "played", label: "Jeu / câlins", emoji: "🎾" },
];

const MOODS: { key: Mood; label: string; emoji: string }[] = [
  { key: "HAPPY", label: "Heureux", emoji: "😊" },
  { key: "CALM", label: "Calme", emoji: "😌" },
  { key: "TIRED", label: "Fatigué", emoji: "😴" },
  { key: "PLAYFUL", label: "Joueur", emoji: "🐕" },
  { key: "ANXIOUS", label: "Anxieux", emoji: "😰" },
];

const EMPTY: ReportState = {
  peed: null, pooed: null, drankWater: null, ate: null, played: null,
  mood: null, energy: null, note: null, incidents: null,
};

function formatWhen(b: BookingCtx): string {
  const fmtDay = (iso: string) => new Intl.DateTimeFormat("fr-CH", { dateStyle: "long", timeZone: "Europe/Zurich" }).format(new Date(iso));
  const fmtTime = (iso: string) => new Intl.DateTimeFormat("fr-CH", { timeStyle: "short", timeZone: "Europe/Zurich" }).format(new Date(iso));
  if (b.startAt && b.endAt) return `${fmtDay(b.startAt)} · ${fmtTime(b.startAt)}–${fmtTime(b.endAt)}`;
  if (b.startDate && b.endDate) return `Du ${fmtDay(b.startDate)} au ${fmtDay(b.endDate)}`;
  return "";
}

export default function ReportComposer({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [booking, setBooking] = useState<BookingCtx | null>(null);
  const [state, setState] = useState<ReportState>(EMPTY);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [alreadySent, setAlreadySent] = useState(false);
  const [initialRoute, setInitialRoute] = useState<LatLng[] | null>(null);
  const [initialDistance, setInitialDistance] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the draft + booking context.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/host/bookings/${encodeURIComponent(bookingId)}/report`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          setNotFound(true);
          return;
        }
        setBooking(json.booking as BookingCtx);
        const r = json.report as LoadedReport | null;
        if (r) {
          setState({
            peed: r.peed, pooed: r.pooed, drankWater: r.drankWater, ate: r.ate, played: r.played,
            mood: (r.mood as Mood | null) ?? null, energy: r.energy, note: r.note, incidents: r.incidents,
          });
          setPhotos(r.photos ?? []);
          setAlreadySent(r.status === "SENT");
          setInitialRoute(Array.isArray(r.routeJson) ? r.routeJson : null);
          setInitialDistance(r.distanceMeters ?? null);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  // Debounced draft autosave (skip while sending / after sent).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: ReportState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/host/bookings/${encodeURIComponent(bookingId)}/report`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }, 600);
  }, [bookingId]);

  const update = useCallback((patch: Partial<ReportState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, [persist]);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const photo = await uploadReportPhoto(bookingId, file);
      setPhotos((p) => [...p, photo]);
    } catch {
      setError("La photo n'a pas pu être envoyée.");
    } finally {
      setUploading(false);
    }
  };

  const onSend = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      // Flush the latest draft synchronously, then send.
      await fetch(`/api/host/bookings/${encodeURIComponent(bookingId)}/report`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      const res = await fetch(`/api/host/bookings/${encodeURIComponent(bookingId)}/report/send`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error === "NOT_STARTED" ? "Le service n'a pas encore commencé." : "L'envoi a échoué. Réessaie.");
        return;
      }
      setSent(true);
      setTimeout(() => router.push("/host/requests"), 1400);
    } catch {
      setError("L'envoi a échoué. Réessaie.");
    } finally {
      setSending(false);
    }
  };

  const whenLabel = useMemo(() => (booking ? formatWhen(booking) : ""), [booking]);
  const dog = booking?.dogName || "ton chien";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#7c3aed]" />
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-base font-semibold text-slate-900">Rapport introuvable</p>
        <p className="max-w-sm text-sm text-slate-500">Ce service n&apos;est pas disponible ou ne t&apos;appartient pas.</p>
        <button onClick={() => router.push("/host/requests")} className="mt-1 rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white">Mes demandes</button>
      </div>
    );
  }
  if (sent) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed]/10">
          <Check className="h-8 w-8 text-[#7c3aed]" />
        </div>
        <p className="text-lg font-semibold text-slate-900">Rapport envoyé !</p>
        <p className="max-w-sm text-sm text-slate-500">Le propriétaire de {dog} vient de recevoir le rapport par mail et dans l&apos;appli.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-40 pt-4">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#7c3aed]">Rapport de service</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{dog}</h1>
        {whenLabel ? <p className="mt-0.5 text-sm text-slate-500">{booking?.service} · {whenLabel}</p> : null}
      </header>

      {alreadySent ? (
        <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ce rapport a déjà été envoyé. Tu peux le compléter et le renvoyer.
        </div>
      ) : null}

      {/* Photos */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-slate-900">Photos</h2>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt="Photo" className="aspect-square w-full rounded-xl object-cover" />
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ touchAction: "manipulation" }}
            className="flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 active:scale-95 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} className="hidden" />
      </section>

      {/* GPS walk tracker (optional) */}
      <WalkTracker bookingId={bookingId} initialRoute={initialRoute} initialDistanceMeters={initialDistance} />

      {/* Checklist */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-slate-900">Le déroulé</h2>
        <div className="flex flex-wrap gap-2">
          {CHECKLIST.map((c) => {
            const on = state[c.key] === true;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => update({ [c.key]: on ? null : true } as Partial<ReportState>)}
                style={{ touchAction: "manipulation" }}
                className={
                  on
                    ? "rounded-full bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] active:scale-95"
                    : "rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 active:scale-95"
                }
              >
                <span className="mr-1">{c.emoji}</span>{c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Mood */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-slate-900">Humeur</h2>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => {
            const on = state.mood === m.key;
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={on}
                onClick={() => update({ mood: on ? null : m.key })}
                style={{ touchAction: "manipulation" }}
                className={
                  on
                    ? "flex items-center gap-1.5 rounded-full bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white active:scale-95"
                    : "flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 active:scale-95"
                }
              >
                <span>{m.emoji}</span>{m.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Energy */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Énergie</h2>
          <span className="text-sm font-semibold text-[#7c3aed]">{state.energy ?? "—"}{state.energy ? "/5" : ""}</span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = (state.energy ?? 0) >= n;
            return (
              <button
                key={n}
                type="button"
                aria-label={`Énergie ${n}`}
                onClick={() => update({ energy: state.energy === n ? null : n })}
                style={{ touchAction: "manipulation" }}
                className={
                  on
                    ? "h-10 flex-1 rounded-xl bg-[#7c3aed] active:scale-95"
                    : "h-10 flex-1 rounded-xl bg-slate-100 active:scale-95"
                }
              />
            );
          })}
        </div>
      </section>

      {/* Note */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-slate-900">Le mot du dogsitter</h2>
        <textarea
          value={state.note ?? ""}
          onChange={(e) => update({ note: e.target.value || null })}
          maxLength={2000}
          rows={4}
          placeholder={`Raconte la journée de ${dog}…`}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7c3aed] focus:outline-none"
        />
      </section>

      {/* Incidents */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-slate-900">À signaler (optionnel)</h2>
        <textarea
          value={state.incidents ?? ""}
          onChange={(e) => update({ incidents: e.target.value || null })}
          maxLength={2000}
          rows={2}
          placeholder="Un souci, une blessure, un comportement inhabituel…"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
        />
      </section>

      {error ? <p className="mb-3 text-center text-sm text-red-600">{error}</p> : null}

      {/* Send bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-[40] border-t border-slate-100 bg-white/95 px-4 pt-3 backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <button
          type="button"
          onClick={onSend}
          aria-busy={sending}
          style={{ touchAction: "manipulation" }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7c3aed] py-3.5 text-base font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.4)] active:scale-[0.99] disabled:opacity-70"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {alreadySent ? "Renvoyer le rapport" : "Envoyer le rapport"}
        </button>
      </div>
    </div>
  );
}
