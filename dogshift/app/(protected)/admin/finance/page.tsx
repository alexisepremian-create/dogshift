import Link from "next/link";

import AdminShell from "@/components/admin/AdminShell";
import InstantSearchForm from "@/components/admin/InstantSearchForm";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PayoutMethod = "STRIPE" | "MANUAL";
type PayoutStatus = "PENDING" | "PAID";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(value)
    .replaceAll(".", "-");
}

function formatDateParts(value: Date | null) {
  const label = formatDate(value);
  if (label === "—") return { day: "—", time: "" };
  const [day, time] = label.split(" ");
  return { day: day || label, time: time || "" };
}

function formatCurrency(cents: number, currency = "chf") {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function payoutAmountCents(booking: { sitterPayoutAmount: number | null; amount: number; platformFeeAmount: number }) {
  if (typeof booking.sitterPayoutAmount === "number" && Number.isFinite(booking.sitterPayoutAmount)) {
    return Math.max(0, Math.round(booking.sitterPayoutAmount));
  }
  return Math.max(0, Math.round(booking.amount - booking.platformFeeAmount));
}

function payoutMethodBadge(method: string) {
  if (method === "MANUAL") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  return "border-sky-200 bg-sky-50 text-sky-900";
}

function payoutStatusBadge(status: string) {
  if (status === "PAID") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function bookingStatusBadge(status: string) {
  if (status === "PAID" || status === "CONFIRMED") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "PENDING_PAYMENT" || status === "PENDING_ACCEPTANCE") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "CANCELLED" || status === "PAYMENT_FAILED" || status === "REFUNDED") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("/admin/finance");

  const params = await searchParams;
  const qRaw = params?.q;
  const payoutMethodRaw = params?.payoutMethod;
  const payoutStatusRaw = params?.payoutStatus;
  const cityRaw = params?.city;
  const startDateRaw = params?.startDate;
  const endDateRaw = params?.endDate;

  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw ?? "").trim();
  const payoutMethodFilter = (Array.isArray(payoutMethodRaw) ? payoutMethodRaw[0] : payoutMethodRaw ?? "").trim() as PayoutMethod | "";
  const payoutStatusFilter = (Array.isArray(payoutStatusRaw) ? payoutStatusRaw[0] : payoutStatusRaw ?? "").trim() as PayoutStatus | "";
  const city = (Array.isArray(cityRaw) ? cityRaw[0] : cityRaw ?? "").trim();
  const startDate = (Array.isArray(startDateRaw) ? startDateRaw[0] : startDateRaw ?? "").trim();
  const endDate = (Array.isArray(endDateRaw) ? endDateRaw[0] : endDateRaw ?? "").trim();

  const createdAtFilter = {
    ...(startDate ? { gte: new Date(`${startDate}T00:00:00.000Z`) } : {}),
    ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
  };

  const where = {
    ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
    ...(payoutMethodFilter ? { payoutMethod: payoutMethodFilter } : {}),
    ...(payoutStatusFilter ? { payoutStatus: payoutStatusFilter } : {}),
    ...(city
      ? {
          sitter: {
            sitterProfile: {
              city: { contains: city, mode: "insensitive" as const },
            },
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" as const } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
            { sitter: { name: { contains: q, mode: "insensitive" as const } } },
            { sitter: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      endDate: true,
      status: true,
      amount: true,
      currency: true,
      platformFeeAmount: true,
      payoutMethod: true,
      payoutStatus: true,
      paidAt: true,
      sitterPayoutAmount: true,
      stripeChargeId: true,
      stripeTransferId: true,
      user: { select: { id: true, name: true, email: true } },
      sitter: { select: { id: true, name: true, email: true, sitterProfile: { select: { city: true } } } },
    },
  });

  const now = new Date();
  const totalPaidVolume = bookings.reduce((sum, b) => sum + (b.status === "PAID" || b.status === "CONFIRMED" ? b.amount : 0), 0);
  const volumeStripe = bookings.reduce(
    (sum, b) => sum + (b.payoutMethod === "STRIPE" && (b.status === "PAID" || b.status === "CONFIRMED") ? b.amount : 0),
    0
  );
  const volumeManual = bookings.reduce(
    (sum, b) => sum + (b.payoutMethod === "MANUAL" && (b.status === "PAID" || b.status === "CONFIRMED") ? b.amount : 0),
    0
  );
  const payoutsPending = bookings.filter((b) => b.payoutStatus === "PENDING").length;
  const payoutsPaid = bookings.filter((b) => b.payoutStatus === "PAID").length;
  const totalPayoutPaid = bookings.reduce((sum, b) => sum + (b.payoutStatus === "PAID" ? payoutAmountCents(b) : 0), 0);
  const totalPayoutManual = bookings.reduce(
    (sum, b) => sum + (b.payoutMethod === "MANUAL" && b.payoutStatus === "PAID" ? payoutAmountCents(b) : 0),
    0
  );
  const manualCount = bookings.filter((b) => b.payoutMethod === "MANUAL").length;
  const stripeCount = bookings.filter((b) => b.payoutMethod === "STRIPE").length;
  const amountToVerify = bookings.reduce((sum, b) => {
    if (b.payoutStatus !== "PENDING") return sum;
    if (b.status !== "PAID" && b.status !== "CONFIRMED") return sum;
    const ended = b.endDate instanceof Date && b.endDate.getTime() <= now.getTime();
    return ended ? sum + payoutAmountCents(b) : sum;
  }, 0);

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Finance</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Dashboard financier</h2>
          <p className="mt-3 text-sm text-slate-600">Vue consolidee des paiements et payouts pour le suivi operationnel admin.</p>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Note:</span> <span className="font-semibold">Payout status = PENDING</span> signifie en general
            que le client a pu payer la reservation, mais que le paiement sitter n&apos;est pas encore marque comme verse.
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Volume total paye</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalPaidVolume)}</p></div>
          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5"><p className="text-sm text-slate-600">Volume Stripe</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(volumeStripe)}</p></div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm text-slate-600">Volume manuel</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(volumeManual)}</p></div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm text-slate-600">Payouts en attente</p><p className="mt-2 text-2xl font-semibold text-slate-900">{payoutsPending}</p></div>
          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5"><p className="text-sm text-slate-600">Payouts payes</p><p className="mt-2 text-2xl font-semibold text-slate-900">{payoutsPaid}</p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Montant payout paye</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalPayoutPaid)}</p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Montant payout manuel</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalPayoutManual)}</p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Bookings MANUAL</p><p className="mt-2 text-2xl font-semibold text-slate-900">{manualCount}</p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Bookings STRIPE</p><p className="mt-2 text-2xl font-semibold text-slate-900">{stripeCount}</p></div>
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5"><p className="text-sm text-slate-600">Montant a verifier</p><p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(amountToVerify)}</p></div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <InstantSearchForm
            action="/admin/finance"
            className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12 xl:items-end"
          >
            <div className="flex flex-col gap-2 xl:col-span-3">
              <label htmlFor="q" className="text-sm font-medium text-slate-700">Recherche</label>
              <input id="q" name="q" defaultValue={q} placeholder="Booking / owner / sitter" className="h-11 rounded-2xl border border-slate-300 px-4 text-sm" />
            </div>
            <div className="flex flex-col gap-2 xl:col-span-2">
              <label htmlFor="payoutMethod" className="text-sm font-medium text-slate-700">Payout method</label>
              <select id="payoutMethod" name="payoutMethod" defaultValue={payoutMethodFilter} className="h-11 rounded-2xl border border-slate-300 px-4 text-sm">
                <option value="">Tous</option>
                <option value="STRIPE">STRIPE</option>
                <option value="MANUAL">MANUAL</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 xl:col-span-2">
              <label htmlFor="payoutStatus" className="text-sm font-medium text-slate-700">Payout status</label>
              <select id="payoutStatus" name="payoutStatus" defaultValue={payoutStatusFilter} className="h-11 rounded-2xl border border-slate-300 px-4 text-sm">
                <option value="">Tous</option>
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 xl:col-span-2">
              <label htmlFor="city" className="text-sm font-medium text-slate-700">Ville sitter</label>
              <input id="city" name="city" defaultValue={city} placeholder="Ville" className="h-11 rounded-2xl border border-slate-300 px-4 text-sm" />
            </div>
            <div className="flex flex-col gap-2 xl:col-span-1">
              <label htmlFor="startDate" className="text-sm font-medium text-slate-700">Du</label>
              <input id="startDate" name="startDate" type="date" defaultValue={startDate} className="h-11 rounded-2xl border border-slate-300 px-4 text-sm" />
            </div>
            <div className="flex flex-col gap-2 xl:col-span-1">
              <label htmlFor="endDate" className="text-sm font-medium text-slate-700">Au</label>
              <input id="endDate" name="endDate" type="date" defaultValue={endDate} className="h-11 rounded-2xl border border-slate-300 px-4 text-sm" />
            </div>
            <div className="xl:col-span-1 flex gap-2">
              <Link href="/admin/finance" className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900">Reset</Link>
            </div>
          </InstantSearchForm>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)]">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Booking</th>
                  <th className="px-4 py-3 font-semibold">Proprietaire</th>
                  <th className="px-4 py-3 font-semibold">Dogsitter</th>
                  <th className="px-4 py-3 font-semibold">Statut booking</th>
                  <th className="px-4 py-3 font-semibold">Montant</th>
                  <th className="px-4 py-3 font-semibold">Payout method</th>
                  <th className="px-4 py-3 font-semibold">Payout status</th>
                  <th className="px-4 py-3 font-semibold">paidAt</th>
                  <th className="px-4 py-3 font-semibold">Charge</th>
                  <th className="px-4 py-3 font-semibold">Transfer</th>
                  <th className="px-4 py-3 font-semibold">Fiche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <div>{formatDateParts(booking.createdAt).day}</div>
                      <div className="text-xs text-slate-500">{formatDateParts(booking.createdAt).time || "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      <div className="max-w-[180px] break-all">{booking.id}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 min-w-[180px]">
                      <div>{booking.user.name?.trim() || "—"}</div>
                      <div className="text-xs text-slate-500">{booking.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 min-w-[180px]">
                      <div>{booking.sitter.name?.trim() || "—"}</div>
                      <div className="text-xs text-slate-500">{booking.sitter.email}</div>
                      <div className="text-xs text-slate-500">{booking.sitter.sitterProfile?.city || "—"}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${bookingStatusBadge(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatCurrency(booking.amount, booking.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${payoutMethodBadge(booking.payoutMethod)}`}>
                        {booking.payoutMethod === "MANUAL" ? "Paye manuellement" : "Paye via Stripe"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${payoutStatusBadge(booking.payoutStatus)}`}>
                        {booking.payoutStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <div>{formatDateParts(booking.paidAt).day}</div>
                      <div className="text-xs text-slate-500">{formatDateParts(booking.paidAt).time || "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600"><div className="max-w-[120px] truncate">{booking.stripeChargeId || "—"}</div></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600"><div className="max-w-[120px] truncate">{booking.stripeTransferId || "—"}</div></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/admin/bookings/${booking.id}`} className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bookings.length === 0 ? <div className="border-t border-slate-200 px-4 py-6 text-sm text-slate-600">Aucun booking pour ces filtres.</div> : null}
        </section>
      </div>
    </AdminShell>
  );
}
