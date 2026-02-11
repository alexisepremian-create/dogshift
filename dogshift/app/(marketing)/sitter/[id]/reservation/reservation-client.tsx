"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

type PricingUnit = "HOURLY" | "DAILY";

type SitterDto = {
  sitterId: string;
  name: string;
  city: string;
  postalCode: string;
  bio: string;
  avatarUrl: string;
  services: string[];
  pricing: Record<string, unknown>;
};

const PRIMARY_BTN =
  "inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50";

function pricingUnitForService(service: string): PricingUnit {
  return service === "Pension" ? "DAILY" : "HOURLY";
}

function isFinitePositiveNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 0;
}

function daysBetweenInclusive(start: string, end: string) {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  const diff = Math.round((b - a) / (24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
}

function computeRoundedHours(startIso: string, endIso: string) {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  const minutes = (b - a) / (60 * 1000);
  const hoursRaw = minutes / 60;
  const hoursRounded = Math.ceil(hoursRaw * 2) / 2;
  return Math.max(0.5, hoursRounded);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function computeEndTime(startTime: string, durationHours: number) {
  const parts = startTime.split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  const totalMinutes = h * 60 + m + durationHours * 60;
  const endMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  return `${pad2(endH)}:${pad2(endM)}`;
}

function toIsoDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDateString(value: string) {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("fr-CH", { month: "long", year: "numeric" }).format(date);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function getMonthGrid(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  // Monday-first index (0..6)
  const jsDay = firstOfMonth.getDay();
  const leading = (jsDay + 6) % 7;

  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < leading; i += 1) {
    const d = new Date(month.getFullYear(), month.getMonth(), 1 - (leading - i));
    cells.push({ date: d, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]?.date ?? new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ date: d, inMonth: false });
  }
  return cells;
}

function DogShiftCalendar({ selected, onSelect }: { selected: string; onSelect: (next: string) => void }) {
  const [month, setMonth] = useState<Date>(() => {
    const parsed = selected ? parseIsoDateString(selected) : null;
    const base = parsed ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    const parsed = selected ? parseIsoDateString(selected) : null;
    if (!parsed) return;
    setMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [selected]);

  const grid = useMemo(() => getMonthGrid(month), [month]);
  const selectedTs = useMemo(() => (selected ? parseIsoDateString(selected)?.getTime() ?? null : null), [selected]);

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
          aria-label="Mois précédent"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <p className="text-sm font-semibold capitalize tracking-tight text-slate-900 sm:text-base">{monthTitle(month)}</p>

        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
          aria-label="Mois suivant"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {(["L", "M", "M", "J", "V", "S", "D"] as const).map((d) => (
          <p key={d} className="text-center text-[11px] font-semibold text-slate-500">
            {d}
          </p>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const iso = toIsoDateString(cell.date);
          const isSelected = selectedTs != null && cell.date.getTime() === selectedTs;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={
                "group inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition duration-150 " +
                (cell.inMonth ? "text-slate-900" : "text-slate-400") +
                (isSelected
                  ? " bg-[var(--dogshift-blue)] text-white shadow-sm"
                  : " hover:bg-[color-mix(in_srgb,var(--dogshift-blue),white_88%)]")
              }
              aria-pressed={isSelected}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function timeOptions15m() {
  const out: string[] = [];
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += 15) {
      out.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return out;
}

function DogShiftTimePicker({
  value,
  onChange,
  label,
  id,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  label: string;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), []);
  const minutes = useMemo(() => ["00", "15", "30", "45"], []);

  const parsed = useMemo(() => {
    if (!value) return null;
    const parts = value.split(":");
    if (parts.length !== 2) return null;
    const hh = parts[0] ?? "";
    const mm = parts[1] ?? "";
    if (!hours.includes(hh)) return null;
    if (!minutes.includes(mm)) return null;
    return { hh, mm };
  }, [hours, minutes, value]);

  const [draftHour, setDraftHour] = useState<string>(() => parsed?.hh ?? pad2(new Date().getHours()));
  const [draftMinute, setDraftMinute] = useState<string>(() => parsed?.mm ?? "00");

  useEffect(() => {
    if (!open) return;
    setDraftHour(parsed?.hh ?? pad2(new Date().getHours()));
    setDraftMinute(parsed?.mm ?? "00");
  }, [open, parsed]);

  const display = value ?? "";

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-slate-600" htmlFor={id}>
        {label}
      </label>

      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={display ? "text-slate-900" : "text-slate-500"}>{display || "Choisir une heure"}</span>
        <span className="text-xs font-semibold text-slate-500">15 min</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-3 w-[min(360px,calc(100vw-32px))]">
          <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)]">
            <div className="flex items-center justify-between gap-3 px-1 pb-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                Fermer
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-2">
                  <p className="px-2 pb-2 text-[11px] font-semibold text-slate-500">Heures</p>
                  <div className="max-h-56 overflow-auto">
                    <div className="grid gap-1">
                      {hours.map((hh) => {
                        const selected = hh === draftHour;
                        return (
                          <button
                            key={hh}
                            type="button"
                            onClick={() => setDraftHour(hh)}
                            className={
                              "flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] " +
                              (selected
                                ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_85%)] text-[var(--dogshift-blue)]"
                                : "text-slate-900 hover:bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)]")
                            }
                          >
                            {hh}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-2">
                  <p className="px-2 pb-2 text-[11px] font-semibold text-slate-500">Minutes</p>
                  <div className="max-h-56 overflow-auto">
                    <div className="grid gap-1">
                      {minutes.map((mm) => {
                        const selected = mm === draftMinute;
                        return (
                          <button
                            key={mm}
                            type="button"
                            onClick={() => setDraftMinute(mm)}
                            className={
                              "flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] " +
                              (selected
                                ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_85%)] text-[var(--dogshift-blue)]"
                                : "text-slate-900 hover:bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)]")
                            }
                          >
                            {mm}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange(`${draftHour}:${draftMinute}`);
                    setOpen(false);
                  }}
                  className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition duration-150 hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                >
                  Valider
                </button>

                {value ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null);
                      setOpen(false);
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition duration-150 hover:bg-slate-50"
                  >
                    Effacer
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DogShiftDatePicker({
  value,
  onChange,
  label,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  id: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-slate-600" htmlFor={id}>
        {label}
      </label>

      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "text-slate-900" : "text-slate-500"}>{value || "Choisir une date"}</span>
        <Calendar className="h-4 w-4 text-slate-500" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-3 w-[min(360px,calc(100vw-32px))]">
          <DogShiftCalendar
            selected={value}
            onSelect={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function ReservationClient({ sitter }: { sitter: SitterDto }) {
  const router = useRouter();

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [startTime, setStartTime] = useState<string | null>(null);
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shouldRenderHourlyDetails, setShouldRenderHourlyDetails] = useState(false);
  const [hourlyDetailsOpen, setHourlyDetailsOpen] = useState(false);

  const pricingRows = useMemo(() => {
    const services = Array.isArray(sitter.services) ? sitter.services : [];
    return services.map((svc) => {
      const raw = sitter.pricing?.[svc];
      const unitPrice = isFinitePositiveNumber(raw) ? raw : null;
      return { service: svc, unitPrice, unit: pricingUnitForService(svc) };
    });
  }, [sitter.pricing, sitter.services]);

  const unit = useMemo<PricingUnit | null>(() => {
    if (!selectedService) return null;
    return pricingUnitForService(selectedService);
  }, [selectedService]);

  useEffect(() => {
    if (unit === "HOURLY") {
      setShouldRenderHourlyDetails(true);
      setHourlyDetailsOpen(false);
      const raf = requestAnimationFrame(() => setHourlyDetailsOpen(true));
      return () => cancelAnimationFrame(raf);
    }

    setHourlyDetailsOpen(false);
  }, [unit]);

  const selectedUnitPrice = useMemo(() => {
    if (!selectedService) return null;
    const raw = sitter.pricing?.[selectedService];
    return isFinitePositiveNumber(raw) ? raw : null;
  }, [selectedService, sitter.pricing]);

  const summary = useMemo(() => {
    if (!selectedService || !unit || !selectedUnitPrice) return null;

    if (unit === "DAILY") {
      if (!dateStart || !dateEnd) return null;
      const days = daysBetweenInclusive(dateStart, dateEnd);
      const subtotal = selectedUnitPrice * days;
      return { unit, quantityLabel: `${days} jour${days > 1 ? "s" : ""}`, unitLabel: "CHF / jour", subtotal };
    }

    if (!durationHours) return null;
    const subtotal = selectedUnitPrice * durationHours;
    return { unit, quantityLabel: `${durationHours} h`, unitLabel: "CHF / heure", subtotal };
  }, [dateEnd, dateStart, durationHours, selectedService, selectedUnitPrice, unit]);

  const canSubmit = useMemo(() => {
    if (!selectedService || !unit) return false;
    if (unit === "DAILY") return Boolean(dateStart && dateEnd && selectedUnitPrice);
    return Boolean(dateStart && startTime && durationHours && selectedUnitPrice);
  }, [dateEnd, dateStart, durationHours, selectedService, selectedUnitPrice, startTime, unit]);

  const endTime = useMemo(() => {
    if (!startTime || !durationHours) return null;
    return computeEndTime(startTime, durationHours);
  }, [durationHours, startTime]);

  async function onContinue() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      if (!selectedService || !unit) {
        setError("Choisis un service.");
        return;
      }

      if (unit === "DAILY") {
        if (!dateStart || !dateEnd) {
          setError("Choisis des dates.");
          return;
        }
        if (dateEnd < dateStart) {
          setError("La date de fin doit être après la date de début.");
          return;
        }
      } else {
        if (!dateStart) {
          setError("Choisis une date.");
          return;
        }
        if (!startTime || !durationHours) {
          setError("Choisis une heure et une durée.");
          return;
        }

        if (dateEnd && dateEnd !== dateStart) {
          setError("Pour l’instant, les services horaires sont limités à une seule journée.");
          return;
        }
      }

      const payload: Record<string, unknown> = {
        sitterId: sitter.sitterId,
        service: selectedService,
        message: message.trim() || null,
      };

      if (unit === "DAILY") {
        payload.startDate = dateStart;
        payload.endDate = dateEnd;
      } else {
        const startLocal = new Date(`${dateStart}T${startTime ?? "00:00"}`);
        const endLocal = new Date(startLocal.getTime() + (durationHours ?? 0) * 60 * 60 * 1000);
        payload.startAt = startLocal.toISOString();
        payload.endAt = endLocal.toISOString();
      }

      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const bookingPayload = (await bookingRes.json()) as { ok?: boolean; bookingId?: string; error?: string };
      const bookingId = typeof bookingPayload?.bookingId === "string" ? bookingPayload.bookingId : "";

      if (bookingRes.status === 401 || bookingPayload?.error === "UNAUTHORIZED") {
        const callbackUrl = `/sitter/${encodeURIComponent(sitter.sitterId)}/reservation`;
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        setError("Connectez-vous pour démarrer la réservation.");
        return;
      }

      if (!bookingRes.ok || !bookingPayload?.ok || !bookingId) {
        if (typeof bookingPayload?.error === "string" && bookingPayload.error) {
          setError(`Impossible de démarrer la réservation (${bookingPayload.error}). Réessayez.`);
        } else {
          setError("Impossible de démarrer la réservation. Réessayez.");
        }
        return;
      }

      router.push(`/checkout/${encodeURIComponent(bookingId)}`);
    } catch {
      setError("Impossible de démarrer la réservation. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Demande de réservation</h1>
            <p className="mt-2 text-sm text-slate-600">Sélectionne un service, des dates, puis continue vers le paiement.</p>
          </div>
          <Link href={`/sitter/${encodeURIComponent(sitter.sitterId)}?mode=public`} className={SECONDARY_BTN}>
            Retour à l’annonce
          </Link>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <p className="text-sm font-semibold text-slate-900">Récapitulatif sitter</p>
              <div className="mt-4 flex items-start gap-4">
                {sitter.avatarUrl ? (
                  <img
                    src={sitter.avatarUrl}
                    alt={sitter.name}
                    className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-200"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 ring-1 ring-slate-200" />
                )}
                <div>
                  <p className="text-base font-semibold text-slate-900">{sitter.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {sitter.city}
                    {sitter.postalCode ? ` · ${sitter.postalCode}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-2">{sitter.bio}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <p className="text-sm font-semibold text-slate-900">Service</p>
              <div className="mt-4 grid gap-2">
                {pricingRows.map((row) => {
                  const selectable = typeof row.unitPrice === "number";
                  const selected = selectedService === row.service;
                  const unitLabel = row.unit === "DAILY" ? " / jour" : " / heure";
                  return (
                    <button
                      key={row.service}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!selectable}
                      onClick={() => {
                        if (!selectable) return;
                        setSelectedService(row.service);
                        setError(null);
                      }}
                      className={
                        selected
                          ? "flex w-full items-center justify-between rounded-2xl border border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] px-4 py-3 text-left text-sm font-semibold text-[var(--dogshift-blue)]"
                          : selectable
                            ? "flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                            : "flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-500"
                      }
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={
                            selected
                              ? "inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--dogshift-blue)]"
                              : "inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-300"
                          }
                          aria-hidden="true"
                        >
                          {selected ? <span className="h-2 w-2 rounded-full bg-[var(--dogshift-blue)]" /> : null}
                        </span>
                        {row.service}
                      </span>
                      <span className={selected ? "text-[var(--dogshift-blue)]" : selectable ? "text-slate-900" : "text-slate-500"}>
                        {selectable ? `CHF ${row.unitPrice}${unitLabel}` : "Prix sur demande"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {shouldRenderHourlyDetails ? (
              <div
                onTransitionEnd={(e) => {
                  if (e.propertyName !== "opacity") return;
                  if (hourlyDetailsOpen) return;
                  setShouldRenderHourlyDetails(false);
                }}
                className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] transition-opacity duration-250 ease-in-out sm:p-8 ${
                  hourlyDetailsOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">Détails (horaire)</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <DogShiftTimePicker
                    id="start_time"
                    label="Heure de début"
                    value={startTime}
                    onChange={(next) => {
                      setStartTime(next);
                      setError(null);
                    }}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-600" htmlFor="duration_hours">
                      Durée
                    </label>
                    <select
                      id="duration_hours"
                      value={durationHours ?? ""}
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : null;
                        setDurationHours(v && Number.isFinite(v) ? v : null);
                        setError(null);
                      }}
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                    >
                      <option value="">Choisir</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>
                          {h} h
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-600">Heure de fin</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{endTime ?? "—"}</p>
                </div>
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <p className="text-sm font-semibold text-slate-900">Dates</p>
              {unit === "DAILY" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <DogShiftDatePicker
                    id="date_start"
                    label="Début"
                    value={dateStart}
                    onChange={(next) => {
                      setDateStart(next);
                      setError(null);
                    }}
                  />
                  <DogShiftDatePicker
                    id="date_end"
                    label="Fin"
                    value={dateEnd}
                    onChange={(next) => {
                      setDateEnd(next);
                      setError(null);
                    }}
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <DogShiftDatePicker
                    id="date_hourly"
                    label="Date"
                    value={dateStart}
                    onChange={(next) => {
                      setDateStart(next);
                      setDateEnd(next);
                      setError(null);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <p className="text-sm font-semibold text-slate-900">Message (optionnel)</p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                placeholder="Décris ton chien et tes attentes."
              />
            </div>
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <p className="text-sm font-semibold text-slate-900">Récap</p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-6 text-sm">
                  <p className="text-slate-600">Service</p>
                  <p className="text-right font-semibold text-slate-900">{selectedService ?? "—"}</p>
                </div>
                <div className="mt-3 flex items-start justify-between gap-6 text-sm">
                  <p className="text-slate-600">Quantité</p>
                  <p className="text-right font-semibold text-slate-900">{summary?.quantityLabel ?? "—"}</p>
                </div>
                <div className="mt-3 flex items-start justify-between gap-6 text-sm">
                  <p className="text-slate-600">Unité</p>
                  <p className="text-right font-semibold text-slate-900">{summary?.unitLabel ?? "—"}</p>
                </div>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex items-start justify-between gap-6 text-sm">
                    <p className="text-slate-600">Sous-total</p>
                    <p className="text-right font-semibold text-slate-900">
                      {summary ? `CHF ${summary.subtotal.toFixed(0)}` : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}

              <button type="button" disabled={!canSubmit || submitting} onClick={() => void onContinue()} className={`mt-6 ${PRIMARY_BTN}`}>
                {submitting ? "Redirection…" : "Continuer"}
              </button>

              <p className="mt-3 text-xs text-slate-500">
                Le montant final est calculé côté serveur au moment de la réservation.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
