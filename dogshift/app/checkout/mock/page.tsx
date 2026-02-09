"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { getSitterById } from "@/lib/mockSitters";
import { DOGSHIFT_COMMISSION_RATE } from "@/lib/commission";
import { appendHostBooking } from "@/lib/hostBookings";

function formatCurrency(value: number) {
  return value.toFixed(2);
}

function safeNumber(raw: string | null) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
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
    return `du ${formatDateHuman(s)} au ${formatDateHuman(e)} inclus`;
  }
  if (s && !e) {
    return `le ${formatDateHuman(s)}`;
  }
  if (!s && e) {
    return `le ${formatDateHuman(e)}`;
  }
  return "—";
}

export default function MockCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white text-slate-900">
          <main className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Paiement</h1>
                  <p className="mt-2 text-sm text-slate-600">Paiement simulé (mock).</p>
                </div>
                <Link
                  href="/search"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Retour
                </Link>
              </div>
            </div>
          </main>
        </div>
      }
    >
      <MockCheckoutClient />
    </Suspense>
  );
}

function MockCheckoutClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const sitterId = (sp.get("sitterId") ?? "").trim();
  const service = (sp.get("service") ?? "").trim();
  const start = (sp.get("start") ?? "").trim();
  const end = (sp.get("end") ?? "").trim();
  const message = (sp.get("message") ?? "").trim();
  const estimate = safeNumber(sp.get("estimate"));

  const sitter = useMemo(() => (sitterId ? getSitterById(sitterId) : undefined), [sitterId]);

  const totalClient = estimate;

  const commission = useMemo(() => {
    if (totalClient === null) return null;
    return Math.round(totalClient * DOGSHIFT_COMMISSION_RATE * 100) / 100;
  }, [totalClient]);

  const payoutSitter = useMemo(() => {
    if (totalClient === null || commission === null) return null;
    return Math.round((totalClient - commission) * 100) / 100;
  }, [totalClient, commission]);

  const [status, setStatus] = useState<"idle" | "paying" | "error">("idle");

  const canPay = Boolean(sitter && service && totalClient !== null && commission !== null && payoutSitter !== null);

  useEffect(() => {
    const isValid = Boolean(sitter && service && totalClient !== null);
    if (isValid) return;

    try {
      sessionStorage.setItem("dogshift_flash", "Réservation invalide");
    } catch {
      // ignore
    }

    router.replace("/search");
  }, [router, sitter, service, totalClient]);

  function onPay(success: boolean) {
    if (!canPay || totalClient === null || commission === null || payoutSitter === null || !sitter) return;

    setStatus("paying");

    window.setTimeout(() => {
      if (!success) {
        setStatus("error");
        return;
      }

      const bookingId = `bk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const createdAt = new Date().toISOString();

      const snapshot = {
        bookingId,
        createdAt,
        sitterId,
        sitterName: sitter.name,
        sitterCity: sitter.city,
        service,
        start,
        end,
        message,
        totalClient: totalClient,
        commissionRate: DOGSHIFT_COMMISSION_RATE,
        commission,
        payoutSitter,
        payment: { provider: "mock", status: "paid" as const },
      };

      try {
        sessionStorage.setItem("dogshift_last_booking", JSON.stringify({ snapshot }));
      } catch {
        // ignore
      }

      try {
        appendHostBooking({
          bookingId,
          createdAt,
          sitterId,
          sitterName: sitter.name,
          sitterCity: sitter.city,
          service,
          start,
          end,
          message,
          totalClient: totalClient,
          payment: { provider: "mock", status: "paid" },
          clientName: "Client (mock)",
        });
      } catch {
        // ignore
      }

      router.push(`/booking/confirmed?bookingId=${encodeURIComponent(bookingId)}`);
    }, 650);
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Paiement</h1>
              <p className="mt-2 text-sm text-slate-600">Paiement simulé (mock).</p>
            </div>
            <Link
              href={sitterId ? `/sitter/${sitterId}` : "/search"}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Retour
            </Link>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Récapitulatif</p>
                <p className="mt-2 text-sm text-slate-600">
                  {sitter ? (
                    <>
                      Dogsitter: <span className="font-semibold text-slate-900">{sitter.name}</span> • {sitter.city}
                    </>
                  ) : (
                    <span className="font-medium text-slate-600">Dogsitter introuvable</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Service: <span className="font-semibold text-slate-900">{service || "—"}</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Dates: <span className="font-semibold text-slate-900">{formatServiceDateRange(start, end)}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-sm text-slate-600">Total client</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {totalClient !== null ? `CHF ${formatCurrency(totalClient)}` : "—"}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-sm">
                <p className="text-slate-600">Total client</p>
                <p className="font-semibold text-slate-900">
                  {totalClient !== null ? `CHF ${formatCurrency(totalClient)}` : "—"}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <p className="text-slate-600">Commission DogShift ({Math.round(DOGSHIFT_COMMISSION_RATE * 100)}%)</p>
                <p className="font-semibold text-slate-900">
                  {commission !== null ? `CHF ${formatCurrency(commission)}` : "—"}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <p className="text-slate-600">Montant reversé au sitter</p>
                <p className="font-semibold text-slate-900">
                  {payoutSitter !== null ? `CHF ${formatCurrency(payoutSitter)}` : "—"}
                </p>
              </div>
            </div>

            {message ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Message</p>
                <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{message}</p>
              </div>
            ) : null}

            {status === "error" ? (
              <p className="mt-5 text-sm font-medium text-rose-600">Paiement refusé (mock). Merci de réessayer.</p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!canPay || status === "paying"}
                onClick={() => onPay(true)}
                className="w-full rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "paying" ? "Paiement…" : "Payer (mock)"}
              </button>

              <button
                type="button"
                disabled={!canPay || status === "paying"}
                onClick={() => onPay(false)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Simuler un échec
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              *Mock: aucun paiement réel n’est effectué. Stripe test mode sera branché ensuite.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
