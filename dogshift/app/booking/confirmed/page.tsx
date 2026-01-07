"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import jsPDF from "jspdf";

import {
  hasReviewForBooking,
  getReviewForBooking,
  stableReviewId,
  upsertReviewInStorage,
  type DogShiftReview,
} from "@/lib/reviews";

type BookingSnapshot = {
  bookingId: string;
  createdAt: string;
  sitterId: string;
  sitterName: string;
  sitterCity: string;
  service: string;
  start: string;
  end: string;
  message: string;
  totalClient: number;
  commissionRate: number;
  commission: number;
  payoutSitter: number;
  payment: { provider: "mock"; status: "paid" };
};

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  // Use UTC to avoid timezone shifts.
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatDateHuman(value: string) {
  const dt = parseIsoDate(value);
  if (!dt) return value;
  return new Intl.DateTimeFormat("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

function formatServiceDateRange(start: string, end: string) {
  const s = start?.trim();
  const e = end?.trim();

  if (s && e) {
    return `Dates de la prestation : du ${formatDateHuman(s)} au ${formatDateHuman(e)} inclus`;
  }
  if (s && !e) {
    return `Date de la prestation : le ${formatDateHuman(s)}`;
  }
  if (!s && e) {
    return `Date de la prestation : le ${formatDateHuman(e)}`;
  }
  return "Dates de la prestation : —";
}

function money(n: number) {
  return n.toFixed(2);
}

function downloadContractPdf(bookingId: string, snapshot: BookingSnapshot) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 64;

  const cguUrl = "/cgu";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Contrat de prestation DogShift", marginX, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Référence: ${snapshot.bookingId}`, marginX, y);
  y += 14;
  doc.text(`Date: ${new Date(snapshot.createdAt).toLocaleString()}`, marginX, y);
  y += 20;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);

  const rawMessage = snapshot.message?.trim() ? snapshot.message.trim() : "";
  const messageForPdf = rawMessage.length > 4000 ? `${rawMessage.slice(0, 4000)}\n\n… (message tronqué)` : rawMessage;

  const blocks: Array<{ title: string; lines: string[] }> = [
    {
      title: "1. Parties",
      lines: [
        "Client: (mock)",
        `Dogsitter: ${snapshot.sitterName} — ${snapshot.sitterCity}`,
        "DogShift agit en tant qu’intermédiaire technique de mise en relation et n’est pas partie à l’exécution matérielle de la prestation.",
      ],
    },
    {
      title: "2. Prestation",
      lines: [
        `Service: ${snapshot.service}`,
        formatServiceDateRange(snapshot.start, snapshot.end),
      ],
    },
    {
      title: "3. Conditions financières",
      lines: [
        `Total client (payé): CHF ${money(snapshot.totalClient)}`,
        `Commission DogShift (${Math.round(snapshot.commissionRate * 100)}%): CHF ${money(snapshot.commission)}`,
        `Montant reversé au sitter: CHF ${money(snapshot.payoutSitter)}`,
      ],
    },
    {
      title: "4. Message client",
      lines: [messageForPdf ? messageForPdf : "—"],
    },
    {
      title: "5. Acceptation",
      lines: [
        "Le paiement vaut acceptation implicite de ce contrat.",
        "Les Conditions Générales d’Utilisation DogShift (CGU) font partie intégrante du présent contrat et ont été acceptées lors de la réservation.",
        `CGU: ${cguUrl}`,
      ],
    },
  ];

  doc.setDrawColor(226, 232, 240);

  for (const block of blocks) {
    if (y > 760) {
      doc.addPage();
      y = 64;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(block.title, marginX, y);
    y += 12;
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    for (const rawLine of block.lines) {
      const wrapped = doc.splitTextToSize(String(rawLine), pageWidth - marginX * 2);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 14 + 4;
      if (y > 780) {
        doc.addPage();
        y = 64;
      }
    }

    y += 8;
  }

  doc.save(`dogshift-contrat-${bookingId}.pdf`);
}

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.366 2.447a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.447a1 1 0 00-1.176 0l-3.366 2.447c-.784.57-1.838-.197-1.54-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.102 9.384c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white text-slate-900">
          <main className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Paiement confirmé</h1>
                  <p className="mt-2 text-sm text-slate-600">Référence: —</p>
                </div>
                <Link
                  href="/search"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Retour aux résultats
                </Link>
              </div>
            </div>
          </main>
        </div>
      }
    >
      <BookingConfirmedClient />
    </Suspense>
  );
}

function BookingConfirmedClient() {
  const sp = useSearchParams();
  const bookingId = (sp.get("bookingId") ?? "").trim();

  const [payload, setPayload] = useState<{ snapshot: unknown } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("dogshift_last_booking");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { snapshot: unknown };
      if (!parsed || typeof parsed !== "object") return;
      setPayload(parsed);
    } catch {
      // ignore
    }
  }, []);

  const snapshot = useMemo(() => {
    if (!payload || !payload.snapshot || typeof payload.snapshot !== "object") return null;
    const snap = payload.snapshot as Partial<BookingSnapshot>;
    if (!snap.bookingId || typeof snap.bookingId !== "string") return null;
    if (!snap.createdAt || typeof snap.createdAt !== "string") return null;
    if (!snap.sitterName || typeof snap.sitterName !== "string") return null;
    if (!snap.sitterCity || typeof snap.sitterCity !== "string") return null;
    if (!snap.service || typeof snap.service !== "string") return null;
    if (typeof snap.totalClient !== "number") return null;
    if (typeof snap.commissionRate !== "number") return null;
    if (typeof snap.commission !== "number") return null;
    if (typeof snap.payoutSitter !== "number") return null;
    return snap as BookingSnapshot;
  }, [payload]);

  const payoutSummary = snapshot
    ? {
        totalClient: snapshot.totalClient,
        commission: snapshot.commission,
        payoutSitter: snapshot.payoutSitter,
        rate: snapshot.commissionRate,
      }
    : null;

  const sitterId = snapshot?.sitterId?.trim() ? snapshot.sitterId.trim() : "";
  const canReview = Boolean(bookingId && sitterId);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [reviewSent, setReviewSent] = useState(false);
  const [reviewExists, setReviewExists] = useState(false);
  const [editingExisting, setEditingExisting] = useState(false);

  useEffect(() => {
    if (!canReview) return;
    setReviewExists(hasReviewForBooking(sitterId, bookingId));
  }, [canReview, sitterId, bookingId]);

  useEffect(() => {
    if (!canReview) return;
    setEditingExisting(false);
    setReviewSent(false);
    setRating(0);
    setComment("");
  }, [canReview, sitterId, bookingId]);

  useEffect(() => {
    if (!canReview) return;
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key !== `ds_reviews_${sitterId}`) return;
      setReviewExists(hasReviewForBooking(sitterId, bookingId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [canReview, sitterId, bookingId]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Paiement confirmé</h1>
              <p className="mt-2 text-sm text-slate-600">Référence: {bookingId || "—"}</p>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Retour aux résultats
            </Link>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Réservation enregistrée (mock)</p>
              <p className="mt-2 text-sm text-slate-600">
                Votre demande a été transmise au dogsitter. La confirmation finale et la messagerie arrivent ensuite.
              </p>
            </div>

            {payoutSummary && payoutSummary.totalClient !== null ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">Récap paiement</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-600">Total client</p>
                    <p className="font-semibold text-slate-900">CHF {payoutSummary.totalClient.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-600">
                      Commission DogShift ({payoutSummary.rate !== null ? Math.round(payoutSummary.rate * 100) : 15}%)
                    </p>
                    <p className="font-semibold text-slate-900">
                      {payoutSummary.commission !== null ? `CHF ${payoutSummary.commission.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-600">Montant reversé au sitter</p>
                    <p className="font-semibold text-slate-900">
                      {payoutSummary.payoutSitter !== null ? `CHF ${payoutSummary.payoutSitter.toFixed(2)}` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {snapshot ? (
              <>
                <div className="mt-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-900">Contrat</p>
                    <button
                      type="button"
                      onClick={() => downloadContractPdf(snapshot.bookingId, snapshot)}
                      className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                    >
                      Télécharger le contrat (PDF)
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Le contrat de référence est généré en PDF à partir de votre réservation.
                  </p>
                </div>

                {canReview ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-sm font-semibold text-slate-900">Laisser un avis sur votre dog-sitter</p>

                    {reviewSent ? (
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-semibold text-emerald-900">Merci pour votre avis</p>
                        <p className="mt-1 text-sm text-emerald-900/80">Il est maintenant visible sur le profil du sitter.</p>
                      </div>
                    ) : reviewExists && !editingExisting ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">Vous avez déjà laissé un avis</p>
                        <p className="mt-1 text-sm text-slate-600">Vous pouvez le modifier (il remplacera l’avis existant).</p>
                        <button
                          type="button"
                          onClick={() => {
                            const existing = getReviewForBooking(sitterId, bookingId);
                            if (existing) {
                              setRating(Math.round(existing.rating));
                              setComment(existing.comment ?? "");
                            }
                            setEditingExisting(true);
                          }}
                          className="mt-3 inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                        >
                          Modifier mon avis
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Note *</p>
                          <div className="mt-2 flex items-center gap-2">
                            {Array.from({ length: 5 }).map((_, idx) => {
                              const v = idx + 1;
                              const active = rating >= v;
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setRating(v)}
                                  className={
                                    active
                                      ? "inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[#F5B301] ring-1 ring-slate-200 transition"
                                      : "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-300 ring-1 ring-slate-200 transition hover:bg-slate-50"
                                  }
                                  aria-label={`Donner ${v} étoile${v > 1 ? "s" : ""}`}
                                >
                                  <Star className="h-5 w-5" />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label htmlFor="review_comment" className="block text-sm font-medium text-slate-700">
                            Commentaire (optionnel)
                          </label>
                          <textarea
                            id="review_comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="mt-2 w-full min-h-[120px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                            placeholder="Partagez votre expérience (optionnel)"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={rating < 1}
                          onClick={() => {
                            const review: DogShiftReview = {
                              id: stableReviewId(),
                              sitterId,
                              bookingId,
                              rating,
                              comment: comment.trim() ? comment.trim() : undefined,
                              authorName: "Client (mock)",
                              createdAt: new Date().toISOString(),
                            };
                            upsertReviewInStorage(review);
                            setReviewSent(true);
                            setReviewExists(true);
                            setEditingExisting(false);
                          }}
                          className="w-full rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {reviewExists ? "Mettre à jour mon avis" : "Envoyer l’avis"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-600">Données de confirmation indisponibles (session expirée).</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
