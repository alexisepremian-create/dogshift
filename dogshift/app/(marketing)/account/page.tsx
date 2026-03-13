import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Hourglass,
  MessageCircle,
  Settings,
} from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";
import { prisma } from "@/lib/prisma";
import { getUserContexts } from "@/lib/userContexts";

export const dynamic = "force-dynamic";

function firstNameFromFullName(name: string) {
  const cleaned = (name ?? "").trim();
  if (!cleaned) return "";
  const part = cleaned.split(" ").filter(Boolean)[0] ?? "";
  return part.trim();
}

function FilledSunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="18" fill="#fbbf24" />
      <polygon points="32,4 26,16 38,16" fill="#fbbf24" />
      <polygon points="32,60 26,48 38,48" fill="#fbbf24" />
      <polygon points="4,32 16,26 16,38" fill="#fbbf24" />
      <polygon points="60,32 48,26 48,38" fill="#fbbf24" />
      <polygon points="12,12 22,18 18,22" fill="#fbbf24" />
      <polygon points="52,12 46,22 42,18" fill="#fbbf24" />
      <polygon points="12,52 18,42 22,46" fill="#fbbf24" />
      <polygon points="52,52 42,46 46,42" fill="#fbbf24" />
    </svg>
  );
}

export default async function AccountDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  void (await searchParams);
  let contexts: Awaited<ReturnType<typeof getUserContexts>>;
  try {
    contexts = await getUserContexts();
  } catch {
    redirect("/login");
  }

  if (contexts.hasSitterProfile) {
    redirect("/host");
  }

  const uid = contexts.dbUserId;

  const clerkUser = await currentUser();
  const rawName = typeof clerkUser?.fullName === "string" ? clerkUser.fullName : "";
  const firstName = firstNameFromFullName(rawName) || "";

  const now = new Date();
  const stalePaymentBefore = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const activeHistoryWhere: Prisma.BookingWhereInput = {
    userId: uid,
    archivedAt: null,
    status: { in: ["PENDING_PAYMENT", "DRAFT", "PENDING_ACCEPTANCE", "PAID", "CONFIRMED"] },
  };

  const [total, pendingPayment, pendingAcceptance, confirmed, unreadMessages, stalePaymentCount, nextBooking] = await Promise.all([
    prisma.booking.count({ where: activeHistoryWhere }),
    prisma.booking.count({ where: { userId: uid, archivedAt: null, status: { in: ["PENDING_PAYMENT", "DRAFT"] } } }),
    prisma.booking.count({ where: { userId: uid, archivedAt: null, status: { in: ["PENDING_ACCEPTANCE", "PAID"] } } }),
    prisma.booking.count({ where: { userId: uid, archivedAt: null, status: "CONFIRMED" } }),
    prisma.message.count({
      where: {
        conversation: { ownerId: uid },
        senderId: { not: uid },
        readAt: null,
      },
    }),
    prisma.booking.count({
      where: {
        userId: uid,
        archivedAt: null,
        status: { in: ["PENDING_PAYMENT", "DRAFT"] },
        createdAt: { lt: stalePaymentBefore },
      },
    }),
    prisma.booking.findFirst({
      where: {
        userId: uid,
        archivedAt: null,
        startDate: { gte: now },
        status: { in: ["CONFIRMED", "PENDING_ACCEPTANCE", "PAID", "PENDING_PAYMENT", "DRAFT"] },
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        service: true,
        startDate: true,
        endDate: true,
        status: true,
        sitter: {
          select: {
            sitterProfile: { select: { displayName: true } },
            name: true,
          },
        },
      },
    }),
  ]);

  const hasUrgent = pendingAcceptance > 0 || unreadMessages > 0 || stalePaymentCount > 0;
  const allConfirmed = total > 0 && confirmed === total;

  const statCardBase =
    "group relative overflow-hidden rounded-3xl border p-6 text-left shadow-sm transition hover:shadow-md sm:p-7";
  const contentCardBase = "relative isolate rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8";
  const quickLinkBase =
    "group inline-flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-sm font-semibold shadow-sm transition";

  function formatDateTimeHuman(dt: Date) {
    return new Intl.DateTimeFormat("fr-CH", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
  }

  function bookingStatusLabel(status: string) {
    if (status === "CONFIRMED") return "Confirmée";
    if (status === "PENDING_ACCEPTANCE" || status === "PAID") return "En attente d’acceptation";
    if (status === "PENDING_PAYMENT" || status === "DRAFT") return "En attente de paiement";
    if (status === "PAYMENT_FAILED") return "Paiement refusé";
    if (status === "CANCELLED") return "Annulée";
    return status || "—";
  }

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="account-dashboard">
      <SunCornerGlow variant="ownerDashboard" />

      <div className="relative z-10">
        <p className="text-sm font-semibold text-slate-600">Mon compte</p>
        <h1 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          <span>Bonjour{firstName ? ` ${firstName}` : ""}</span>
          {firstName ? <FilledSunIcon className="h-7 w-7" /> : null}
        </h1>
        <div className="mt-3 flex min-h-[32px] items-center">
          <p className="text-sm text-slate-600">Retrouve tes réservations, messages et paramètres.</p>
        </div>
        {!hasUrgent ? <p className="mt-3 text-sm font-medium text-slate-500">Tout est calme pour le moment 😊</p> : null}
        {allConfirmed ? <p className="mt-2 text-sm font-medium text-emerald-700">Bravo 🎉 toutes tes réservations sont confirmées.</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/account/bookings?tab=pending&pending=payment" className={`${statCardBase} border-amber-200 bg-amber-50 hover:bg-amber-50/80`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-900">En attente de paiement</p>
          </div>
          <CreditCard className="absolute right-6 top-6 h-6 w-6 text-amber-600" aria-hidden="true" />
          <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-950">{pendingPayment}</p>
          <p className="mt-2 text-xs font-medium text-amber-800/80">Voir les réservations à payer</p>
        </Link>

        <Link href="/account/bookings?tab=pending&pending=acceptance" className={`${statCardBase} border-[color-mix(in_srgb,var(--dogshift-blue),white_55%)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] hover:bg-[color-mix(in_srgb,var(--dogshift-blue),white_89%)]`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[color-mix(in_srgb,var(--dogshift-blue),black_25%)]">En attente d’acceptation</p>
          </div>
          <Hourglass className="absolute right-6 top-6 h-6 w-6 text-[color-mix(in_srgb,var(--dogshift-blue),black_15%)]" aria-hidden="true" />
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[color-mix(in_srgb,var(--dogshift-blue),black_20%)]">{pendingAcceptance}</p>
          <p className="mt-2 text-xs font-medium text-[color-mix(in_srgb,var(--dogshift-blue),black_35%)]">Voir les demandes en attente</p>
        </Link>

        <Link href="/account/bookings?tab=confirmed" className={`${statCardBase} border-emerald-200 bg-emerald-50 hover:bg-emerald-50/80`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-900">Confirmées</p>
          </div>
          <CheckCircle2 className="absolute right-6 top-6 h-6 w-6 text-emerald-600" aria-hidden="true" />
          <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">{confirmed}</p>
          <p className="mt-2 text-xs font-medium text-emerald-800/80">Voir les réservations confirmées</p>
        </Link>

        <Link href="/account/bookings?tab=all" className={`${statCardBase} border-slate-200 bg-white hover:bg-slate-50`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Historique total</p>
          </div>
          <BarChart3 className="absolute right-6 top-6 h-6 w-6 text-slate-500" aria-hidden="true" />
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{total}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">Voir l’historique actif des réservations</p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${contentCardBase} lg:col-span-2`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Prochaine réservation</h2>
              <p className="mt-1 text-sm text-slate-600">Un aperçu rapide de ce qui arrive.</p>
            </div>
          </div>

          {nextBooking?.startDate ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Chien : —</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {typeof nextBooking.service === "string" && nextBooking.service.trim() ? nextBooking.service.trim() : "Service"}
                    {" "}·{" "}
                    {formatDateTimeHuman(new Date(nextBooking.startDate))}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Dogsitter :{" "}
                    {((nextBooking.sitter as any)?.sitterProfile?.displayName as string | undefined) ||
                      (typeof (nextBooking.sitter as any)?.name === "string" ? (nextBooking.sitter as any).name : "—")}
                  </p>
                </div>

                <div className="shrink-0">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                    {bookingStatusLabel(String(nextBooking.status))}
                  </span>
                  <div className="mt-3">
                    <Link
                      href={`/account/bookings/${encodeURIComponent(String(nextBooking.id))}`}
                      className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                    >
                      Voir détails
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Aucune réservation prévue pour le moment.</p>
              <p className="mt-1 text-sm text-slate-600">Quand tu réserves un dogsitter, la prochaine date apparaîtra ici.</p>
            </div>
          )}
        </div>

        <div className={contentCardBase}>
          <h2 className="text-lg font-semibold text-slate-900">Accès rapide</h2>
          <p className="mt-1 text-sm text-slate-600">Aller à l’essentiel.</p>
          <div className="mt-5 grid gap-3">
            <Link
              href="/account/bookings"
              className={`${quickLinkBase} border-slate-200 bg-white text-slate-900 hover:bg-slate-50`}
            >
              <span className="inline-flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden="true" />
                Réservations
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link
              href="/account/messages"
              className={`${quickLinkBase} border-slate-200 bg-white text-slate-900 hover:bg-slate-50`}
            >
              <span className="inline-flex items-center gap-3">
                <MessageCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />
                Messages
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link
              href="/account/settings"
              className={`${quickLinkBase} border-slate-200 bg-white text-slate-900 hover:bg-slate-50`}
            >
              <span className="inline-flex items-center gap-3">
                <Settings className="h-4 w-4 text-slate-500" aria-hidden="true" />
                Paramètres
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {hasUrgent ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">À traiter</h2>
          <p className="mt-1 text-sm text-slate-600">Petites alertes, gros gain de clarté.</p>

          <div className="mt-5 space-y-2">
            {pendingAcceptance > 0 ? (
              <Link
                href="/account/bookings?tab=pending&pending=acceptance"
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  {pendingAcceptance} réservation{pendingAcceptance > 1 ? "s" : ""} en attente d’acceptation
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            ) : null}

            {unreadMessages > 0 ? (
              <Link
                href="/account/messages"
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {unreadMessages} nouveau{unreadMessages > 1 ? "x" : ""} message{unreadMessages > 1 ? "s" : ""}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            ) : null}

            {stalePaymentCount > 0 ? (
              <Link
                href="/account/bookings?tab=pending&pending=payment"
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-orange-600" aria-hidden="true" />
                  {stalePaymentCount} paiement{stalePaymentCount > 1 ? "s" : ""} en attente depuis plus de 48h
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>

          <p className="mt-4 text-sm text-slate-600">Pense à répondre rapidement pour améliorer ton taux de réponse.</p>
        </div>
      ) : null}
    </div>
  );
}
