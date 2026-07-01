 
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
 
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight, Home, MapPin, Scissors, AlertTriangle } from "lucide-react";

import { useMaintenance } from "@/components/platform/MaintenanceProvider";
import { maintenanceBookingUserMessage } from "@/lib/platform/maintenanceConstants";
import { cancellationPolicyVariantFromStartMs } from "@/lib/reservation/cancellationPolicyUi";
import { DOG_SIZE_WEIGHTS, dogSizeKeyFromWeight } from "@/lib/constants/dog-sizes";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";

type PricingUnit = "HOURLY" | "DAILY";

type ServiceDayStatus = "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";

type HourlySlot = {
  startAt: string;
  endAt: string;
  startMin?: number;
  endMin?: number;
  status: ServiceDayStatus;
  reason?: string;
};

type TimePickerSlot = {
  time: string;
  available: boolean;
};

type DurationPickerOption = {
  hours: number;
  available: boolean;
};

type StartAvailability = {
  startAt: string;
  startMin: number;
  status: ServiceDayStatus;
  compatibleDurationMin: number[];
};

type ConfiguredTimeRange = {
  startAt: string;
  endAt: string;
  startMin: number;
  endMin: number;
  status: "AVAILABLE" | "ON_REQUEST";
};

type HourlyConfig = {
  minDurationMin: number;
  maxDurationMin: number;
  stepMin: number;
};

type DayStatusRow = {
  date: string;
  promenadeStatus: ServiceDayStatus;
  dogsittingStatus: ServiceDayStatus;
  pensionStatus: ServiceDayStatus;
};

const TRAVEL_RATE_CHF_PER_KM = 0.66;
const MAX_TRAVEL_RADIUS_KM = 15;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type SitterDto = {
  sitterId: string;
  name: string;
  city: string;
  postalCode: string;
  bio: string;
  avatarUrl: string;
  services: string[];
  pricing: Record<string, unknown>;
  lat?: number | null;
  lng?: number | null;
  hasAddress?: boolean;
  pensionAcceptedSizes?: string[];
  acceptanceCriteria?: { neuteredRequired?: boolean; maxDogs?: number | null } | null;
};

const PRIMARY_BTN =
  "inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50";

function pricingUnitForService(service: string): PricingUnit {
  return service === "Pension" || service === "Garde" ? "DAILY" : "HOURLY";
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

function formatDurationHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "";
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${wholeHours} h`;
  if (wholeHours === 0) return `${minutes} min`;
  return `${wholeHours}h${String(minutes).padStart(2, "0")}`;
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

function formatDisplayDate(value: string) {
  const parsed = parseIsoDateString(value);
  if (!parsed) return value;
  return `${pad2(parsed.getDate())}-${pad2(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
}

function serviceStatusForLabel(row: DayStatusRow | null, service: string): ServiceDayStatus {
  if (!row) return "UNAVAILABLE";
  if (service === "Promenade") return row.promenadeStatus;
  if (service === "Garde") return row.dogsittingStatus;
  if (service === "Pension") return row.pensionStatus;
  return "UNAVAILABLE";
}

function calendarServiceColorClasses(service: string | null) {
  if (service === "Promenade") {
    return {
      available: " border-sky-200 bg-sky-50 text-sky-900",
      selected: " border-sky-500 bg-sky-100 text-sky-950 shadow-sm ring-2 ring-sky-300",
      hover: " hover:border-sky-300",
    };
  }
  if (service === "Garde") {
    return {
      available: " border-violet-200 bg-violet-50 text-violet-900",
      selected: " border-violet-500 bg-violet-100 text-violet-950 shadow-sm ring-2 ring-violet-300",
      hover: " hover:border-violet-300",
    };
  }
  if (service === "Pension") {
    return {
      available: " border-emerald-200 bg-emerald-50 text-emerald-900",
      selected: " border-emerald-500 bg-emerald-100 text-emerald-950 shadow-sm ring-2 ring-emerald-300",
      hover: " hover:border-emerald-300",
    };
  }
  return {
    available: " border-slate-200 bg-slate-50 text-slate-900",
    selected: " border-slate-500 bg-slate-100 text-slate-950 shadow-sm ring-2 ring-slate-300",
    hover: " hover:border-slate-300",
  };
}

function isBookableStatus(status: ServiceDayStatus) {
  return status === "AVAILABLE" || status === "ON_REQUEST";
}

function serviceToApiType(service: string | null): "PROMENADE" | "DOGSITTING" | "PENSION" | null {
  if (service === "Promenade") return "PROMENADE";
  if (service === "Garde") return "DOGSITTING";
  if (service === "Pension") return "PENSION";
  return null;
}

function isoToTimeLabel(value: string) {
  if (typeof value !== "string") return "";
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatZurichIsoDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function todayZurichIsoDate() {
  return formatZurichIsoDate(new Date());
}

function addDaysLocal(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

function dateRangeIsoInclusive(startIso: string, endIso: string) {
  const a = parseIsoDateString(startIso);
  const b = parseIsoDateString(endIso);
  if (!a || !b) return null;
  if (b.getTime() < a.getTime()) return null;
  const out: string[] = [];
  for (let d = a; d.getTime() <= b.getTime(); d = addDaysLocal(d, 1)) {
    out.push(toIsoDateString(d));
  }
  return out;
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

function monthBoundsIso(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return {
    from: toIsoDateString(first),
    to: toIsoDateString(last),
  };
}

function DogShiftCalendar({
  selected,
  onSelect,
  isDisabled,
  getDayStatus,
  selectedService,
  todayIso,
}: {
  selected: string;
  onSelect: (next: string) => void;
  isDisabled?: (iso: string) => boolean;
  getDayStatus?: (iso: string) => ServiceDayStatus;
  selectedService?: string | null;
  todayIso: string;
}) {
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
  const serviceColors = useMemo(() => calendarServiceColorClasses(selectedService ?? null), [selectedService]);

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
        {(["L", "M", "M", "J", "V", "S", "D"] as const).map((d, idx) => (
          <p key={`dow-${idx}-${d}`} className="text-center text-[11px] font-semibold text-slate-500">
            {d}
          </p>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const iso = toIsoDateString(cell.date);
          const isSelected = selectedTs != null && cell.date.getTime() === selectedTs;
          const isPast = iso < todayIso;
          const disabled = Boolean(isDisabled?.(iso));
          const dayStatus = getDayStatus?.(iso) ?? "UNAVAILABLE";
          const isBookable = dayStatus === "AVAILABLE" || dayStatus === "ON_REQUEST";
          const statusClasses = isPast
            ? " border-slate-300 bg-slate-400 text-slate-50"
            : isBookable
              ? serviceColors.available
              : " border-slate-200 bg-slate-100 text-slate-500";
          const selectedClasses = isPast
            ? " border-slate-500 bg-slate-500 text-white shadow-sm ring-2 ring-slate-400"
            : isBookable
              ? serviceColors.selected
              : " border-slate-300 bg-slate-200 text-slate-700 shadow-sm ring-2 ring-slate-300";
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onSelect(iso);
              }}
              className={
                "group inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition duration-150 " +
                (cell.inMonth ? "" : " opacity-45") +
                (isSelected ? selectedClasses : statusClasses) +
                (disabled ? " cursor-not-allowed" : "") +
                (!isSelected && !disabled && !isPast && isBookable ? serviceColors.hover : "")
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
  open,
  onOpenChange,
  slots,
  disabled,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  label: string;
  id: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  slots?: TimePickerSlot[];
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const normalizedSlots = useMemo(() => {
    const values = Array.isArray(slots)
      ? slots.filter(
          (item): item is TimePickerSlot => Boolean(item && typeof item.time === "string" && item.time.length === 5 && typeof item.available === "boolean")
        )
      : [];

    const deduped = new Map<string, boolean>();
    for (const item of values) {
      deduped.set(item.time, item.available);
    }

    return Array.from(deduped.entries())
      .map(([time, available]) => ({ time, available }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [slots]);
  const selectableTimes = useMemo(() => normalizedSlots.filter((slot) => slot.available).map((slot) => slot.time), [normalizedSlots]);
  const [draftValue, setDraftValue] = useState<string | null>(() => value ?? selectableTimes[0] ?? null);

  useEffect(() => {
    if (!open) return;
    setDraftValue(value && selectableTimes.includes(value) ? value : selectableTimes[0] ?? null);
  }, [open, selectableTimes, value]);

  const hasSlots = normalizedSlots.length > 0;
  const hasAllowedTimes = selectableTimes.length > 0;
  const isCandidateAllowed = Boolean(draftValue && selectableTimes.includes(draftValue));

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [onOpenChange, open]);

  const display = value ?? "";

  return (
    <div ref={rootRef} className="relative">
      <label className="block text-xs font-semibold text-slate-600" htmlFor={id}>
        {label}
      </label>

      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className="mt-2 inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={display ? "text-slate-900" : "text-slate-500"}>{display || (disabled ? "Choisir d’abord une durée" : "Choisir une heure")}</span>
      </button>

      {open && !disabled ? (
        <div className="absolute left-1/2 top-full z-50 mt-3 w-[min(360px,calc(100vw-32px))] -translate-x-1/2">
          <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)]">
            <div className="flex items-center justify-between gap-3 px-1 pb-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                Fermer
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <p className="px-2 pb-2 text-[11px] font-semibold text-slate-500">
                {hasSlots ? "Heures valides en clair, heures impossibles grisées et barrées" : "Aucun horaire disponible"}
              </p>
              <div className="rounded-2xl border border-slate-200 bg-white p-2">
                <div className="max-h-64 overflow-auto">
                  <div className="grid gap-1 sm:grid-cols-2">
                    {normalizedSlots.map((slot) => {
                      const selected = slot.time === draftValue;
                      const unavailableClasses =
                        "border border-slate-200 bg-slate-100 text-slate-400 line-through decoration-slate-400 decoration-2 opacity-80";
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => {
                            if (!slot.available) return;
                            setDraftValue(slot.time);
                          }}
                          className={
                            "flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] disabled:cursor-not-allowed " +
                            (selected
                              ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_85%)] text-[var(--dogshift-blue)]"
                              : slot.available
                                ? "text-slate-900 hover:bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)]"
                                : unavailableClasses)
                          }
                          aria-disabled={!slot.available}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!hasAllowedTimes || !isCandidateAllowed}
                  onClick={() => {
                    onChange(draftValue ?? null);
                    onOpenChange(false);
                  }}
                  className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition duration-150 hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Valider
                </button>

                {value ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null);
                      onOpenChange(false);
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

function DogShiftDurationPicker({
  value,
  onChange,
  label,
  id,
  open,
  onOpenChange,
  options,
  disabled,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  label: string;
  id: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  options: DurationPickerOption[];
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const display = value ? formatDurationHours(value) : "";

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [onOpenChange, open]);

  return (
    <div ref={rootRef} className="relative">
      <label className="block text-xs font-semibold text-slate-600" htmlFor={id}>
        {label}
      </label>

      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className="mt-2 inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={display ? "text-slate-900" : "text-slate-500"}>{display || (disabled ? "Choisir d’abord une heure" : "Choisir une durée")}</span>
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 top-full z-50 mt-3 w-[min(220px,calc(100vw-32px))]">
          <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)]">
            <div className="flex items-center justify-between gap-3 px-1 pb-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
              >
                Fermer
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-2">
                <p className="px-2 pb-2 text-[11px] font-semibold text-slate-500">Durée</p>
                <div className="max-h-56 overflow-auto">
                  <div className="grid gap-1">
                    {options.map((option) => {
                      const selected = option.hours === value;
                      return (
                        <button
                          key={option.hours}
                          type="button"
                          disabled={!option.available}
                          onClick={() => {
                            if (!option.available) return;
                            onChange(option.hours);
                            onOpenChange(false);
                          }}
                          className={
                            "flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:line-through " +
                            (selected
                              ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_85%)] text-[var(--dogshift-blue)]"
                              : option.available
                                ? "text-slate-900 hover:bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)]"
                                : "text-slate-400")
                          }
                        >
                          {formatDurationHours(option.hours)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {value ? (
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null);
                      onOpenChange(false);
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition duration-150 hover:bg-slate-50"
                  >
                    Effacer
                  </button>
                </div>
              ) : null}
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
  isDisabled,
  getDayStatus,
  selectedService,
  todayIso,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  id: string;
  isDisabled?: (iso: string) => boolean;
  getDayStatus?: (iso: string) => ServiceDayStatus;
  selectedService?: string | null;
  todayIso: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
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
        <span className={value ? "text-slate-900" : "text-slate-500"}>{value ? formatDisplayDate(value) : "Choisir une date"}</span>
        <Calendar className="h-4 w-4 text-slate-500" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-3 w-[min(360px,calc(100vw-32px))]">
          <DogShiftCalendar
            selected={value}
            isDisabled={isDisabled}
            getDayStatus={getDayStatus}
            selectedService={selectedService}
            todayIso={todayIso}
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

export default function ReservationClient({
  sitter,
  embedded = false,
  initialParams,
}: {
  sitter: SitterDto;
  // When true, render without the full-page chrome (no min-h-screen, no title,
  // no "Retour à l'annonce") so this exact flow can live inside the native home
  // popup. `initialParams` seed the service/date when there's no URL to read
  // them from (the popup passes them here).
  embedded?: boolean;
  initialParams?: { service?: string; date?: string; start?: string; end?: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { maintenanceMode, adminNote } = useMaintenance();

  const LEAD_TIME_MINUTES = 30;
  const LAST_MINUTE_MAX_HOURS = 24;

  const [openPicker, setOpenPicker] = useState<"time" | "duration" | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [startTime, setStartTime] = useState<string | null>(null);
  const [durationHours, setDurationHours] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [dogSize, setDogSize] = useState<string | null>(null);
  const [numberOfDogs, setNumberOfDogs] = useState<number>(1);

  const [locationMode, setLocationMode] = useState<"AT_SITTER" | "AT_OWNER">("AT_SITTER");
  const [ownerStreet, setOwnerStreet] = useState("");
  const [ownerNpa, setOwnerNpa] = useState("");
  const [ownerCity, setOwnerCity] = useState("");
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const [travelPreview, setTravelPreview] = useState<{ distanceKm: number; feeCents: number; feeChf: number; ownerLat: number; ownerLng: number } | null>(null);
  const [travelError, setTravelError] = useState<string | null>(null);

  const [dogs, setDogs] = useState<Array<{ id: string; name: string; breed: string | null; weightKg: number | null; isDefault: boolean; photoUrl: string | null }>>([]);
  const [dogsLoading, setDogsLoading] = useState(true);
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);
  const [ownerPhone, setOwnerPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateDayStatus, setSelectedDateDayStatus] = useState<DayStatusRow | null>(null);
  const [selectedDateStatusLoaded, setSelectedDateStatusLoaded] = useState(false);
  const [calendarMonthStatuses, setCalendarMonthStatuses] = useState<Record<string, DayStatusRow>>({});
  const [, setHourlySlots] = useState<HourlySlot[]>([]);
  const [, setHourlySlotsLoading] = useState(false);
  const [, setHourlySlotsLoaded] = useState(false);
  const [, setHourlySlotsError] = useState<string | null>(null);
  const [hourlyConfig, setHourlyConfig] = useState<HourlyConfig | null>(null);
  const [startAvailabilities, setStartAvailabilities] = useState<StartAvailability[]>([]);
  const [configuredRanges, setConfiguredRanges] = useState<ConfiguredTimeRange[]>([]);
  const [lastMinuteEnabled, setLastMinuteEnabled] = useState<boolean | null>(null);
  const [durationSlotMap, setDurationSlotMap] = useState<Record<number, HourlySlot[]>>({});
  const [durationSlotsLoading, setDurationSlotsLoading] = useState(false);

  // Combined address for geocoding (street + NPA + city)
  const ownerAddressCombined = [ownerStreet.trim(), [ownerNpa.trim(), ownerCity.trim()].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  // Geocode owner address and compute travel preview
  useEffect(() => {
    const hasAllFields = ownerStreet.trim() && ownerNpa.trim() && ownerCity.trim();
    if (locationMode !== "AT_OWNER" || !hasAllFields || !sitter.hasAddress) {
      setTravelPreview(null);
      setTravelError(null);
      return;
    }

    const combined = [ownerStreet.trim(), [ownerNpa.trim(), ownerCity.trim()].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");

    const timer = setTimeout(() => {
      let cancelled = false;
      setGeocodingAddress(true);
      setTravelPreview(null);
      setTravelError(null);

      void (async () => {
        try {
          const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
          if (!apiKey) return;

          const q = encodeURIComponent(combined);
          const res = await fetch(
            `https://api.maptiler.com/geocoding/${q}.json?key=${apiKey}&language=fr&country=ch&limit=1`
          );
          if (cancelled) return;
          if (!res.ok) return;

          const data = (await res.json()) as {
            features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
          };
          const feature = data.features?.[0];
          if (!feature?.geometry?.coordinates) return;
          const [ownerLng, ownerLat] = feature.geometry.coordinates;

          if (!Number.isFinite(ownerLat) || !Number.isFinite(ownerLng)) return;
          if (cancelled) return;

          if (!sitter.lat || !sitter.lng) return;

          const distanceKm = haversineKm(sitter.lat, sitter.lng, ownerLat, ownerLng);

          if (distanceKm > MAX_TRAVEL_RADIUS_KM) {
            setTravelError(
              `Ce sitter ne se déplace pas jusqu'à votre adresse (${distanceKm.toFixed(1)} km, max. 15 km).`
            );
            setTravelPreview(null);
            return;
          }

          const feeChf = Math.round(distanceKm * TRAVEL_RATE_CHF_PER_KM * 100) / 100;
          const feeCents = Math.round(feeChf * 100);
          setTravelPreview({ distanceKm, feeCents, feeChf, ownerLat, ownerLng });
          setTravelError(null);
        } catch {
          // silent — user will see error at submit
        } finally {
          if (!cancelled) setGeocodingAddress(false);
        }
      })();

      return () => { cancelled = true; };
    }, 700);

    return () => clearTimeout(timer);
  }, [locationMode, ownerStreet, ownerNpa, ownerCity, sitter.hasAddress, sitter.lat, sitter.lng]);

  const todayIso = useMemo(() => todayZurichIsoDate(), []);
  const now = useMemo(() => new Date(), [dateStart]);
  const nowMs = now.getTime();
  const isTodaySelected = Boolean(dateStart && dateStart === todayIso);
  const earliestAllowedMs = useMemo(() => (isTodaySelected ? nowMs + LEAD_TIME_MINUTES * 60 * 1000 : nowMs), [isTodaySelected, nowMs]);
  const earliestLastMinuteAllowedMs = useMemo(
    () => (lastMinuteEnabled === false ? nowMs + LAST_MINUTE_MAX_HOURS * 60 * 60 * 1000 : nowMs),
    [LAST_MINUTE_MAX_HOURS, lastMinuteEnabled, nowMs]
  );
  const earliestAllowedTimeLabel = `${pad2(new Date(earliestAllowedMs).getHours())}:${pad2(new Date(earliestAllowedMs).getMinutes())}`;

  useEffect(() => {
    // Embedded (native popup) has no URL to read from → fall back to initialParams.
    const serviceParam = (initialParams?.service ?? searchParams.get("service") ?? "").trim();
    const dateParam = (initialParams?.date ?? searchParams.get("date") ?? "").trim();
    const startParam = (initialParams?.start ?? searchParams.get("start") ?? "").trim();
    const endParam = (initialParams?.end ?? searchParams.get("end") ?? "").trim();

    const serviceExists = sitter.services.some((svc) => svc === serviceParam);
    if (serviceExists) {
      setSelectedService((prev) => prev ?? serviceParam);
    }

    if (serviceParam === "Pension") {
      if (startParam) setDateStart((prev) => prev || startParam);
      if (endParam) setDateEnd((prev) => prev || endParam);
      return;
    }

    if (dateParam) {
      setDateStart((prev) => prev || dateParam);
      setDateEnd((prev) => prev || dateParam);
    }
  }, [searchParams, sitter.services]);

  useEffect(() => {
    fetch("/api/account/dogs")
      .then((r) => r.json())
      .then((data: { dogs?: Array<{ id: string; name: string; breed: string | null; weightKg: number | null; isDefault: boolean; photoUrl: string | null }> }) => {
        if (Array.isArray(data.dogs)) {
          setDogs(data.dogs);
          const def = data.dogs.find((d) => d.isDefault) ?? (data.dogs.length === 1 ? data.dogs[0] : null);
          if (def) {
            setSelectedDogIds([def.id]);
            const sizeKey = dogSizeKeyFromWeight(def.weightKg);
            if (sizeKey) setDogSize(sizeKey);
          }
        }
      })
      .catch(() => {})
      .finally(() => setDogsLoading(false));
  }, []);

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

  const effectiveSelectedDate = useMemo(() => {
    if (dateStart) return dateStart;
    return "";
  }, [dateStart]);

  const calendarStatusService = useMemo(() => {
    if (selectedService && sitter.services.includes(selectedService)) return selectedService;
    if (sitter.services.length === 1) return sitter.services[0] ?? null;
    return null;
  }, [selectedService, sitter.services]);

  useEffect(() => {
    if (!calendarStatusService) {
      setCalendarMonthStatuses({});
      return;
    }

    let cancelled = false;

    const loadMonthStatuses = async (monthDate: Date) => {
      const { from, to } = monthBoundsIso(monthDate);
      try {
        const qp = new URLSearchParams();
        qp.set("from", from);
        qp.set("to", to);
        const res = await fetch(`/api/sitters/${encodeURIComponent(sitter.sitterId)}/day-status/multi?${qp.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; days?: DayStatusRow[] } | null;
        if (cancelled || !res.ok || !payload?.ok || !Array.isArray(payload.days)) return;
        const days = payload.days;
        setCalendarMonthStatuses((prev) => {
          const next = { ...prev };
          for (const row of days) {
            if (!row || typeof row.date !== "string") continue;
            next[row.date] = row;
          }
          return next;
        });
      } catch {
        if (cancelled) return;
      }
    };

    const monthsToLoad = new Set<string>();
    const current = new Date();
    monthsToLoad.add(`${current.getFullYear()}-${current.getMonth()}`);
    const selected = effectiveSelectedDate ? parseIsoDateString(effectiveSelectedDate) : null;
    if (selected) {
      monthsToLoad.add(`${selected.getFullYear()}-${selected.getMonth()}`);
    }

    void Promise.all(
      Array.from(monthsToLoad).map((key) => {
        const [yearRaw, monthRaw] = key.split("-");
        const year = Number(yearRaw);
        const month = Number(monthRaw);
        return loadMonthStatuses(new Date(year, month, 1));
      })
    );

    return () => {
      cancelled = true;
    };
  }, [calendarStatusService, effectiveSelectedDate, sitter.sitterId]);

  useEffect(() => {
    if (!effectiveSelectedDate) {
      setSelectedDateDayStatus(null);
      setSelectedDateStatusLoaded(false);
      return;
    }

    let cancelled = false;
    setSelectedDateStatusLoaded(false);

    void (async () => {
      try {
        const qp = new URLSearchParams();
        qp.set("from", effectiveSelectedDate);
        qp.set("to", effectiveSelectedDate);
        const res = await fetch(`/api/sitters/${encodeURIComponent(sitter.sitterId)}/day-status/multi?${qp.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; days?: DayStatusRow[] } | null;
        if (cancelled) return;
        if (!res.ok || !payload?.ok || !Array.isArray(payload.days)) {
          setSelectedDateDayStatus(null);
          setSelectedDateStatusLoaded(true);
          return;
        }
        const row = payload.days.find((day) => day?.date === effectiveSelectedDate) ?? null;
        setSelectedDateDayStatus(row);
        setSelectedDateStatusLoaded(true);
      } catch {
        if (cancelled) return;
        setSelectedDateDayStatus(null);
        setSelectedDateStatusLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSelectedDate, sitter.sitterId]);

  const selectablePricingRows = useMemo(() => {
    if (!effectiveSelectedDate || !selectedDateStatusLoaded || !selectedDateDayStatus) {
      return pricingRows;
    }
    return pricingRows.filter((row) => {
      if (typeof row.unitPrice !== "number") return false;
      const status = serviceStatusForLabel(selectedDateDayStatus, row.service);
      return status === "AVAILABLE" || status === "ON_REQUEST";
    });
  }, [effectiveSelectedDate, pricingRows, selectedDateDayStatus, selectedDateStatusLoaded]);

  useEffect(() => {
    if (!effectiveSelectedDate || !selectedDateStatusLoaded) return;

    const nextRows = selectablePricingRows;
    if (nextRows.length === 0) {
      if (selectedService !== null) {
        setSelectedService(null);
      }
      return;
    }

    const stillValid = selectedService ? nextRows.some((row) => row.service === selectedService) : false;
    if (stillValid) return;

    if (nextRows.length === 1) {
      setSelectedService(nextRows[0]?.service ?? null);
      return;
    }

    setSelectedService((prev) => {
      if (prev && nextRows.some((row) => row.service === prev)) return prev;
      return null;
    });
  }, [effectiveSelectedDate, selectablePricingRows, selectedDateStatusLoaded, selectedService]);

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

    let subtotal: number;
    let quantityLabel: string;
    let unitLabel: string;

    if (unit === "DAILY") {
      if (!dateStart || !dateEnd) return null;
      const days = daysBetweenInclusive(dateStart, dateEnd);
      subtotal = selectedUnitPrice * days;
      quantityLabel = `${days} jour${days > 1 ? "s" : ""}`;
      unitLabel = "CHF / jour";
    } else {
      if (!durationHours) return null;
      subtotal = selectedUnitPrice * durationHours;
      quantityLabel = `${durationHours} h`;
      unitLabel = "CHF / heure";
    }

    const travelFeeChf = locationMode === "AT_OWNER" && travelPreview ? travelPreview.feeChf : 0;
    const total = subtotal + travelFeeChf;

    return { unit, quantityLabel, unitLabel, subtotal, travelFeeChf, total };
  }, [dateEnd, dateStart, durationHours, locationMode, selectedService, selectedUnitPrice, travelPreview, unit]);

  const getCalendarDayStatus = useMemo(() => {
    return (iso: string): ServiceDayStatus => {
      if (!calendarStatusService) return "UNAVAILABLE";
      if (iso < todayIso) return "UNAVAILABLE";
      const row = calendarMonthStatuses[iso] ?? null;
      return serviceStatusForLabel(row, calendarStatusService);
    };
  }, [calendarMonthStatuses, calendarStatusService, todayIso]);

  const isDateDisabled = useMemo(() => {
    return (iso: string) => {
      if (!iso) return true;
      if (iso < todayIso) return true;
      const status = getCalendarDayStatus(iso);
      return !isBookableStatus(status);
    };
  }, [getCalendarDayStatus, todayIso]);

  const isReservationDateBookable = useMemo(() => {
    return (iso: string) => {
      if (!calendarStatusService || !iso || iso < todayIso) return false;
      const row = calendarMonthStatuses[iso] ?? (selectedDateDayStatus?.date === iso ? selectedDateDayStatus : null);
      return isBookableStatus(serviceStatusForLabel(row, calendarStatusService));
    };
  }, [calendarMonthStatuses, calendarStatusService, selectedDateDayStatus, todayIso]);

  const endTime = useMemo(() => {
    if (!startTime || !durationHours) return null;
    return computeEndTime(startTime, durationHours);
  }, [durationHours, startTime]);

  useEffect(() => {
    if (unit !== "HOURLY" || !selectedService || !dateStart) {
      setHourlySlots([]);
      setHourlySlotsLoading(false);
      setHourlySlotsLoaded(false);
      setHourlySlotsError(null);
      setHourlyConfig(null);
      setStartAvailabilities([]);
      setConfiguredRanges([]);
      setLastMinuteEnabled(null);
      return;
    }

    const serviceType = serviceToApiType(selectedService);
    if (!serviceType || serviceType === "PENSION") {
      setHourlySlots([]);
      setHourlySlotsLoaded(false);
      setHourlyConfig(null);
      setStartAvailabilities([]);
      setConfiguredRanges([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      setHourlySlots([]);
      setHourlySlotsLoading(true);
      setHourlySlotsLoaded(false);
      setHourlySlotsError(null);
      try {
        const qp = new URLSearchParams();
        qp.set("date", dateStart);
        qp.set("service", serviceType);
        const res = await fetch(`/api/sitters/${encodeURIComponent(sitter.sitterId)}/slots?${qp.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean;
          slots?: HourlySlot[];
          config?: HourlyConfig;
          starts?: StartAvailability[];
          configuredRanges?: ConfiguredTimeRange[];
          lastMinuteEnabled?: boolean;
        } | null;
        if (cancelled) return;
        if (!res.ok || !payload?.ok || !Array.isArray(payload.slots)) {
          setHourlySlots([]);
          setHourlySlotsError("SLOTS_ERROR");
          setHourlySlotsLoaded(true);
          setHourlyConfig(null);
          setStartAvailabilities([]);
          setConfiguredRanges([]);
          setLastMinuteEnabled(null);
          return;
        }
        setHourlySlots(
          payload.slots.filter(
            (slot): slot is HourlySlot =>
              Boolean(slot && typeof slot.startAt === "string" && typeof slot.endAt === "string" && typeof slot.status === "string")
          )
        );
        setHourlyConfig(payload.config && typeof payload.config.minDurationMin === "number" && typeof payload.config.maxDurationMin === "number" && typeof payload.config.stepMin === "number" ? payload.config : null);
        setStartAvailabilities(
          Array.isArray(payload.starts)
            ? payload.starts.filter(
                (start): start is StartAvailability =>
                  Boolean(
                    start &&
                    typeof start.startAt === "string" &&
                    typeof start.startMin === "number" &&
                    Array.isArray(start.compatibleDurationMin) &&
                    typeof start.status === "string"
                  )
              )
            : []
        );
        setConfiguredRanges(
          Array.isArray(payload.configuredRanges)
            ? payload.configuredRanges.filter(
                (range): range is ConfiguredTimeRange =>
                  Boolean(
                    range &&
                    typeof range.startAt === "string" &&
                    typeof range.endAt === "string" &&
                    typeof range.startMin === "number" &&
                    typeof range.endMin === "number" &&
                    (range.status === "AVAILABLE" || range.status === "ON_REQUEST")
                  )
              )
            : []
        );
        setLastMinuteEnabled(typeof payload.lastMinuteEnabled === "boolean" ? payload.lastMinuteEnabled : null);
        setHourlySlotsLoaded(true);
      } catch (fetchError) {
        if (cancelled) return;
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setHourlySlots([]);
        setHourlySlotsError("SLOTS_NETWORK_ERROR");
        setHourlySlotsLoaded(true);
        setHourlyConfig(null);
        setStartAvailabilities([]);
        setConfiguredRanges([]);
        setLastMinuteEnabled(null);
      } finally {
        if (cancelled) return;
        setHourlySlotsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dateStart, selectedService, sitter.sitterId, unit]);

  useEffect(() => {
    if (unit !== "DAILY" || !selectedService || !dateStart) {
      if (unit !== "HOURLY") setLastMinuteEnabled(null);
      return;
    }

    const serviceType = serviceToApiType(selectedService);
    if (!serviceType) {
      setLastMinuteEnabled(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const qp = new URLSearchParams();
        qp.set("date", dateStart);
        qp.set("service", serviceType);
        const res = await fetch(`/api/sitters/${encodeURIComponent(sitter.sitterId)}/slots?${qp.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; lastMinuteEnabled?: boolean } | null;
        if (cancelled) return;
        setLastMinuteEnabled(typeof payload?.lastMinuteEnabled === "boolean" ? payload.lastMinuteEnabled : null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLastMinuteEnabled(null);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dateStart, selectedService, sitter.sitterId, unit]);

  const durationOptions = useMemo<DurationPickerOption[]>(() => {
    if (unit !== "HOURLY" || !hourlyConfig) return [];
    const stepMin = Math.max(1, hourlyConfig.stepMin);
    const minDurationMin = Math.max(stepMin, hourlyConfig.minDurationMin);
    const maxDurationMin = Math.max(minDurationMin, hourlyConfig.maxDurationMin);
    const out: DurationPickerOption[] = [];
    for (let durationMin = minDurationMin; durationMin <= maxDurationMin; durationMin += stepMin) {
      out.push({ hours: durationMin / 60, available: true });
    }
    return out;
  }, [hourlyConfig, unit]);

  const displayedDurationMinSet = useMemo(
    () => new Set(durationOptions.map((option) => option.hours * 60)),
    [durationOptions]
  );

  const minDurationMinForService = useMemo(() => {
    if (unit !== "HOURLY" || !hourlyConfig) return null;
    const stepMin = Math.max(1, hourlyConfig.stepMin);
    return Math.max(stepMin, hourlyConfig.minDurationMin);
  }, [hourlyConfig, unit]);

  const configuredEndMinForStartMin = useCallback(
    (startMin: number) => {
      const range = configuredRanges.find((r) => startMin >= r.startMin && startMin < r.endMin) ?? null;
      return range?.endMin ?? null;
    },
    [configuredRanges]
  );

  useEffect(() => {
    setDurationSlotMap({});
    setDurationSlotsLoading(false);
    if (unit !== "HOURLY" || !selectedService || !dateStart || durationOptions.length === 0) {
      return;
    }

    const serviceType = serviceToApiType(selectedService);
    if (!serviceType || serviceType === "PENSION") return;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      setDurationSlotsLoading(true);
      try {
        const results = await Promise.all(
          durationOptions.map(async (option) => {
            const qp = new URLSearchParams();
            qp.set("date", dateStart);
            qp.set("service", serviceType);
            qp.set("durationMin", String(option.hours * 60));
            const res = await fetch(`/api/sitters/${encodeURIComponent(sitter.sitterId)}/slots?${qp.toString()}`, {
              method: "GET",
              cache: "no-store",
              signal: controller.signal,
            });
            const payload = (await res.json().catch(() => null)) as { ok?: boolean; slots?: HourlySlot[] } | null;
            const slots = res.ok && payload?.ok && Array.isArray(payload.slots)
              ? payload.slots.filter(
                  (slot): slot is HourlySlot =>
                    Boolean(slot && typeof slot.startAt === "string" && typeof slot.endAt === "string" && typeof slot.status === "string")
                )
              : [];
            return [option.hours, slots] as const;
          })
        );
        if (cancelled) return;
        setDurationSlotMap(Object.fromEntries(results));
      } catch (fetchError) {
        if (cancelled) return;
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setDurationSlotMap({});
      } finally {
        if (cancelled) return;
        setDurationSlotsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dateStart, durationOptions, selectedService, sitter.sitterId, unit]);

  const availableStartTimes = useMemo(() => {
    if (unit !== "HOURLY") return [];
    if (!minDurationMinForService) return [];

    const out = startAvailabilities
      .filter((start) => start.status === "AVAILABLE" || start.status === "ON_REQUEST")
      .filter((start) => {
        // Must support at least the minimum duration.
        const supportsMin = start.compatibleDurationMin.includes(minDurationMinForService);
        // Must fit within configured availability window.
        const endMin = configuredEndMinForStartMin(start.startMin);
        const fitsRange = endMin !== null && start.startMin + minDurationMinForService <= endMin;

        if (process.env.NODE_ENV !== "production") {
          const label = isoToTimeLabel(start.startAt);
          if (label === "15:30") {
            console.log("[reservation][hourly][start-debug]", {
              selectedService,
              dateStart,
              label,
              startMin: start.startMin,
              minDurationMinForService,
              compatibleDurationMin: start.compatibleDurationMin,
              configuredRange: endMin === null ? null : { endMin },
              supportsMin,
              fitsRange,
              earliestAllowedMs: isTodaySelected ? earliestAllowedMs : null,
              startAt: start.startAt,
            });
          }
        }

        return supportsMin && fitsRange;
      })
      .filter((start) => {
        const ts = new Date(start.startAt).getTime();
        if (!Number.isFinite(ts)) return false;
        if (ts < earliestLastMinuteAllowedMs) return false;
        if (!isTodaySelected) return true;
        return ts >= earliestAllowedMs;
      })
      .map((start) => isoToTimeLabel(start.startAt))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (process.env.NODE_ENV !== "production") {
      // One-shot-ish snapshot to understand configured ranges & min duration.
      if (dateStart && selectedService === "Promenade") {
        console.log("[reservation][hourly][debug-snapshot]", {
          selectedService,
          dateStart,
          minDurationMinForService,
          configuredRanges: configuredRanges.map((r) => ({ startMin: r.startMin, endMin: r.endMin, status: r.status })),
          startAvailabilitiesCount: startAvailabilities.length,
          availableStartTimesCount: out.length,
        });
      }
    }

    return out;
  }, [
    configuredEndMinForStartMin,
    configuredRanges,
    dateStart,
    earliestAllowedMs,
    earliestLastMinuteAllowedMs,
    isTodaySelected,
    minDurationMinForService,
    lastMinuteEnabled,
    selectedService,
    startAvailabilities,
    unit,
  ]);

  const timePickerSlots = useMemo(
    () =>
      startAvailabilities.map((start) => {
        const time = isoToTimeLabel(start.startAt);
        return {
          time,
          available: availableStartTimes.includes(time),
        };
      }),
    [availableStartTimes, startAvailabilities]
  );

  const durationOptionsForStart = useMemo<DurationPickerOption[]>(() => {
    if (!startTime) {
      return durationOptions.map((option) => ({ ...option, available: false }));
    }

    return durationOptions.map((option) => {
      const slots = durationSlotMap[option.hours] ?? [];
      const available = slots.some((slot) => {
        if (!(slot.status === "AVAILABLE" || slot.status === "ON_REQUEST")) return false;
        if (isoToTimeLabel(slot.startAt) !== startTime) return false;
        const startMs = new Date(slot.startAt).getTime();
        if (isTodaySelected && Number.isFinite(startMs) && startMs < earliestAllowedMs) return false;
        return true;
      });
      return { ...option, available };
    });
  }, [durationOptions, durationSlotMap, earliestAllowedMs, isTodaySelected, startTime]);

  const selectedDurationSlots = useMemo(() => {
    if (!durationHours) return [];
    return durationSlotMap[durationHours] ?? [];
  }, [durationHours, durationSlotMap]);

  const selectedHourlySlot = useMemo(() => {
    if (!startTime || !endTime) return null;
    return (
      selectedDurationSlots.find((slot) => {
        if (isoToTimeLabel(slot.startAt) !== startTime) return false;
        if (isoToTimeLabel(slot.endAt) !== endTime) return false;
        if (!(slot.status === "AVAILABLE" || slot.status === "ON_REQUEST")) return false;
        if (!isTodaySelected) return true;
        const startMs = new Date(slot.startAt).getTime();
        return Number.isFinite(startMs) && startMs >= earliestAllowedMs;
      }) ?? null
    );
  }, [earliestAllowedMs, endTime, isTodaySelected, selectedDurationSlots, startTime]);

  const canSubmit = useMemo(() => {
    if (maintenanceMode) return false;
    if (!selectedService || !unit) return false;
    if (locationMode === "AT_OWNER") {
      if (!ownerStreet.trim() || !ownerNpa.trim() || !ownerCity.trim()) return false;
      if (travelError) return false;
      if (geocodingAddress) return false;
      if (!travelPreview) return false;
    }
    if (unit === "DAILY") return Boolean(dateStart && dateEnd && selectedUnitPrice);
    return Boolean(dateStart && startTime && durationHours && selectedUnitPrice && selectedHourlySlot);
  }, [
    dateEnd,
    dateStart,
    durationHours,
    geocodingAddress,
    locationMode,
    maintenanceMode,
    ownerStreet,
    ownerNpa,
    ownerCity,
    selectedHourlySlot,
    selectedService,
    selectedUnitPrice,
    startTime,
    travelError,
    travelPreview,
    unit,
  ]);

  const disabledReason = useMemo(() => {
    if (canSubmit) return null;
    if (maintenanceMode) return null;
    if (!selectedService) return "Sélectionne un service pour continuer.";
    if (unit === "HOURLY") {
      if (!dateStart) return "Sélectionne une date pour continuer.";
      if (!startTime) return "Sélectionne une heure de début pour continuer.";
      if (!durationHours) return "Sélectionne une durée pour continuer.";
      if (!selectedHourlySlot) return "Ce créneau n'est plus disponible, choisis un autre horaire.";
    }
    if (unit === "DAILY") {
      if (!dateStart) return "Sélectionne une date de début pour continuer.";
      if (!dateEnd) return "Sélectionne une date de fin pour continuer.";
    }
    return null;
  }, [canSubmit, dateEnd, dateStart, durationHours, maintenanceMode, selectedHourlySlot, selectedService, startTime, unit]);

  const recapCancellationVariant = useMemo(() => {
    if (!selectedService || !unit) return null;
    if (unit === "DAILY") {
      if (!dateStart) return null;
      const startMs = new Date(`${dateStart}T00:00:00Z`).getTime();
      return cancellationPolicyVariantFromStartMs(Number.isFinite(startMs) ? startMs : null);
    }
    if (!dateStart || !selectedHourlySlot) return null;
    const startMs = new Date(selectedHourlySlot.startAt).getTime();
    return cancellationPolicyVariantFromStartMs(Number.isFinite(startMs) ? startMs : null);
  }, [dateStart, selectedHourlySlot, selectedService, unit]);

  const hasLeadTimeOnlyForToday = useMemo(() => {
    if (!isTodaySelected) return false;
    if (availableStartTimes.length > 0) return false;

    const compatibleStarts = startAvailabilities.filter(
      (start) =>
        (start.status === "AVAILABLE" || start.status === "ON_REQUEST") &&
        start.compatibleDurationMin.some((durationMin) => displayedDurationMinSet.has(durationMin))
    );

    return compatibleStarts.some((start) => {
      const ts = new Date(start.startAt).getTime();
      return Number.isFinite(ts) && ts >= nowMs && ts < earliestAllowedMs;
    });
  }, [
    availableStartTimes.length,
    displayedDurationMinSet,
    earliestAllowedMs,
    isTodaySelected,
    nowMs,
    startAvailabilities,
  ]);

  const resetInvalidHourlySelection = useCallback(() => {
    setStartTime(null);
    setDateEnd("");
  }, []);

  useEffect(() => {
    if (!startTime) return;
    if (!availableStartTimes.includes(startTime)) {
      resetInvalidHourlySelection();
      if (isTodaySelected) {
        const startAvailability = startAvailabilities.find((s) => isoToTimeLabel(s.startAt) === startTime);
        const startMs = startAvailability ? new Date(startAvailability.startAt).getTime() : NaN;
        if (Number.isFinite(startMs) && startMs < earliestAllowedMs) {
          setError(`Ce créneau doit commencer au moins ${LEAD_TIME_MINUTES} min dans le futur (à partir de ${earliestAllowedTimeLabel}).`);
          return;
        }
      }
      setError("Ce créneau vient d’être réservé ou n’est plus disponible, merci de choisir un autre horaire.");
    }
  }, [
    LEAD_TIME_MINUTES,
    availableStartTimes,
    earliestAllowedMs,
    earliestAllowedTimeLabel,
    isTodaySelected,
    resetInvalidHourlySelection,
    startAvailabilities,
    startTime,
  ]);

  useEffect(() => {
    if (!durationHours) return;
    const currentOption = durationOptionsForStart.find((option) => option.hours === durationHours);
    if (currentOption?.available) return;
    setDurationHours(null);
  }, [durationHours, durationOptionsForStart]);

  // Surface "no slots today" and "last-minute disabled" as visible errors in sticky CTA
  useEffect(() => {
    if (!isTodaySelected || unit !== "HOURLY") return;
    if (lastMinuteEnabled === false) {
      setError("Ce sitter n'accepte pas les réservations de dernière minute. Choisissez une date au minimum 24h à l'avance.");
      return;
    }
    if (hasLeadTimeOnlyForToday) {
      setError("Aucun créneau disponible pour aujourd\u2019hui — tous les horaires sont passés. Choisissez une date prochaine.");
      return;
    }
    if (availableStartTimes.length === 0 && startAvailabilities.length === 0 && !durationSlotsLoading) {
      setError("Aucune disponibilité pour aujourd\u2019hui. Choisissez une date prochaine.");
    }
   
  }, [isTodaySelected, unit, lastMinuteEnabled, hasLeadTimeOnlyForToday, availableStartTimes.length, startAvailabilities.length, durationSlotsLoading]);

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
        const span = dateRangeIsoInclusive(dateStart, dateEnd);
        if (!span || span.length === 0) {
          setError("Choisis des dates.");
          return;
        }
        if (span.some((d) => d < todayIso)) {
          setError("Impossible de choisir une date passée.");
          return;
        }
        if (span.some((d) => !isReservationDateBookable(d))) {
          setError("Une ou plusieurs dates ne sont pas disponibles.");
          return;
        }

        const startMs = new Date(`${dateStart}T00:00:00.000Z`).getTime();
        const deltaMs = startMs - Date.now();
        if (Number.isFinite(deltaMs) && deltaMs < LEAD_TIME_MINUTES * 60 * 1000) {
          setError("Les réservations doivent être effectuées au minimum 30 minutes à l’avance.");
          return;
        }
        if (lastMinuteEnabled === false && Number.isFinite(startMs) && startMs < nowMs + LAST_MINUTE_MAX_HOURS * 60 * 60 * 1000) {
          setError("Les réservations doivent être effectuées au minimum 24h à l’avance.");
          return;
        }
      } else {
        if (!dateStart) {
          setError("Choisis une date.");
          return;
        }
        if (!startTime) {
          setError("Sélectionne une heure de début pour continuer.");
          return;
        }
        if (!durationHours) {
          setError("Sélectionne une durée pour continuer.");
          return;
        }
        if (dateStart < todayIso) {
          setError("Impossible de choisir une date passée.");
          return;
        }
        if (isTodaySelected) {
          const startAvailability = startAvailabilities.find((s) => isoToTimeLabel(s.startAt) === startTime);
          const startMs = startAvailability ? new Date(startAvailability.startAt).getTime() : NaN;
          if (Number.isFinite(startMs) && startMs < earliestAllowedMs) {
            setError(`Ce créneau doit commencer au moins ${LEAD_TIME_MINUTES} min dans le futur (à partir de ${earliestAllowedTimeLabel}).`);
            return;
          }
        }
        if (!isReservationDateBookable(dateStart)) {
          setError("Cette date n’est pas disponible.");
          return;
        }
        if (!selectedHourlySlot) {
          resetInvalidHourlySelection();
          setError("Ce créneau vient d’être réservé ou n’est plus disponible, merci de choisir un autre horaire.");
          return;
        }

        const startMs = new Date(selectedHourlySlot.startAt).getTime();
        const deltaMs = startMs - Date.now();
        if (Number.isFinite(deltaMs) && deltaMs < LEAD_TIME_MINUTES * 60 * 1000) {
          resetInvalidHourlySelection();
          setError("Les réservations doivent être effectuées au minimum 30 minutes à l’avance.");
          return;
        }
        if (lastMinuteEnabled === false && Number.isFinite(deltaMs) && deltaMs < LAST_MINUTE_MAX_HOURS * 60 * 60 * 1000) {
          resetInvalidHourlySelection();
          setError("Les réservations doivent être effectuées au minimum 24h à l’avance.");
          return;
        }

        setDateEnd(dateStart);
      }

      // Pension: dog profile required, must be selected, and must have weight
      if (selectedService === "Pension" && !dogsLoading) {
        if (dogs.length === 0) {
          setError("Pour réserver la pension, vous devez d'abord ajouter la fiche de votre chien dans votre compte.");
          return;
        }
        if (selectedDogIds.length === 0) {
          setError("Veuillez sélectionner votre chien pour réserver la pension.");
          return;
        }
        const firstSelected = dogs.find((d) => d.id === selectedDogIds[0]);
        if (!firstSelected?.weightKg) {
          setError("Le poids de votre chien n'est pas renseigné. Veuillez compléter sa fiche pour réserver la pension — cette information est nécessaire pour vérifier la taille.");
          return;
        }
      }

      // Pension size validation (derives from dog weight, never from manual picker)
      const pensionSizes = sitter.pensionAcceptedSizes ?? [];
      if (selectedService === "Pension" && pensionSizes.length > 0) {
        const firstSelected = dogs.find((d) => d.id === selectedDogIds[0]);
        const computedSize = firstSelected?.weightKg ? dogSizeKeyFromWeight(firstSelected.weightKg) : null;
        const effectiveDogSize = computedSize ?? dogSize;
        if (!effectiveDogSize) {
          setError("Impossible de déterminer la taille de votre chien. Veuillez renseigner son poids dans sa fiche.");
          return;
        }
        if (!pensionSizes.includes(effectiveDogSize)) {
          setError(`Ce sitter n'accepte pas les chiens de taille ${DOG_SIZE_WEIGHTS[effectiveDogSize as keyof typeof DOG_SIZE_WEIGHTS]?.label ?? effectiveDogSize} en pension.`);
          return;
        }
      }

      // Acceptance criteria validation
      const criteria = sitter.acceptanceCriteria;
      if (criteria?.maxDogs && numberOfDogs > criteria.maxDogs) {
        setError(`Ce sitter accepte au maximum ${criteria.maxDogs} chien${criteria.maxDogs > 1 ? "s" : ""} simultanément.`);
        return;
      }

      const payload: Record<string, unknown> = {
        sitterId: sitter.sitterId,
        service: selectedService,
        message: message.trim() || null,
        locationMode,
        ownerAddress: locationMode === "AT_OWNER" ? ownerAddressCombined : null,
        ownerLat: locationMode === "AT_OWNER" && travelPreview ? travelPreview.ownerLat : null,
        ownerLng: locationMode === "AT_OWNER" && travelPreview ? travelPreview.ownerLng : null,
        ...(dogSize ? { dogSize } : {}),
        numberOfDogs,
        dogProfileId: selectedDogIds[0] ?? null,
        additionalDogProfileIds: selectedDogIds.slice(1),
        ownerPhone: ownerPhone.trim() || null,
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

      const bookingPayload = (await bookingRes.json()) as { ok?: boolean; bookingId?: string; error?: string; message?: string };
      const bookingId = typeof bookingPayload?.bookingId === "string" ? bookingPayload.bookingId : "";

      if (bookingRes.status === 503 || bookingPayload?.error === "MAINTENANCE") {
        setError(maintenanceBookingUserMessage(adminNote));
        return;
      }

      if (bookingRes.status === 401 || bookingPayload?.error === "UNAUTHORIZED") {
        const callbackUrl = `/sitter/${encodeURIComponent(sitter.sitterId)}/reservation`;
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        setError("Connectez-vous pour démarrer la réservation.");
        return;
      }

      if (!bookingRes.ok || !bookingPayload?.ok || !bookingId) {
        if (typeof bookingPayload?.message === "string" && bookingPayload.message) {
          setError(bookingPayload.message);
          return;
        }
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
    <div className={embedded ? "bg-white text-slate-900" : "min-h-screen bg-white text-slate-900"}>
      <main className={embedded ? "mx-auto max-w-5xl px-4 pt-2 pb-32 sm:px-6" : "mx-auto max-w-5xl px-4 pt-4 pb-32 sm:px-6 sm:pt-6 lg:pb-10"}>
        {embedded ? null : (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Demande de réservation</h1>
              <p className="mt-2 text-sm text-slate-600">Sélectionne un service, des dates, puis continue vers le paiement.</p>
            </div>
            <Link href={`/sitter/${encodeURIComponent(sitter.sitterId)}?mode=public`} className={SECONDARY_BTN}>
              Retour à l’annonce
            </Link>
          </div>
        )}

        <div className={embedded ? "grid gap-8 lg:grid-cols-[1fr_360px]" : "mt-8 grid gap-8 lg:grid-cols-[1fr_360px]"}>
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
              <p className="text-sm font-semibold text-slate-900">Dates</p>
              {unit === "DAILY" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <DogShiftDatePicker
                    id="date_start"
                    label="Début"
                    value={dateStart}
                    getDayStatus={getCalendarDayStatus}
                    isDisabled={isDateDisabled}
                    selectedService={calendarStatusService}
                    todayIso={todayIso}
                    onChange={(next) => {
                      setDateStart(next);
                      setError(null);
                    }}
                  />
                  <DogShiftDatePicker
                    id="date_end"
                    label="Fin"
                    value={dateEnd}
                    getDayStatus={getCalendarDayStatus}
                    isDisabled={isDateDisabled}
                    selectedService={calendarStatusService}
                    todayIso={todayIso}
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
                    getDayStatus={getCalendarDayStatus}
                    isDisabled={isDateDisabled}
                    selectedService={calendarStatusService}
                    todayIso={todayIso}
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
              <p className="text-sm font-semibold text-slate-900">Service</p>
              {effectiveSelectedDate && selectedDateStatusLoaded ? (
                <p className="mt-2 text-sm text-slate-600">
                  Services disponibles le {formatDisplayDate(effectiveSelectedDate)} selon les disponibilités du sitter.
                </p>
              ) : null}
              {lastMinuteEnabled === true ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                  Réservation de dernière minute disponible
                </div>
              ) : null}
              <div className="mt-4 grid gap-2">
                {selectablePricingRows.map((row) => {
                  const status = effectiveSelectedDate && selectedDateStatusLoaded ? serviceStatusForLabel(selectedDateDayStatus, row.service) : null;
                  const selectable = typeof row.unitPrice === "number" && (status === null || status === "AVAILABLE" || status === "ON_REQUEST");
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
                {effectiveSelectedDate && selectedDateStatusLoaded && selectablePricingRows.length === 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                    Aucun service réservable n’est disponible le {formatDisplayDate(effectiveSelectedDate)}.
                  </div>
                ) : null}
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
                    open={openPicker === "time"}
                    slots={timePickerSlots}
                    disabled={!dateStart || timePickerSlots.length === 0}
                    onOpenChange={(next) => setOpenPicker(next ? "time" : null)}
                    onChange={(next) => {
                      setStartTime(next);
                      setDurationHours(null);
                      setError(null);
                    }}
                  />
                  <DogShiftDurationPicker
                    id="duration_hours"
                    label="Durée"
                    value={durationHours}
                    open={openPicker === "duration"}
                    options={durationOptionsForStart}
                    disabled={!startTime || durationOptionsForStart.length === 0 || durationSlotsLoading}
                    onOpenChange={(next) => setOpenPicker(next ? "duration" : null)}
                    onChange={(next) => {
                      setDurationHours(next);
                      setError(null);
                    }}
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-600">Heure de fin</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{endTime ?? "—"}</p>
                </div>

                {isTodaySelected && hasLeadTimeOnlyForToday ? (
                  <p className="mt-4 text-sm font-medium text-rose-700">Aucun créneau disponible pour aujourd’hui.</p>
                ) : null}

                {dateStart && !startTime && !hasLeadTimeOnlyForToday ? (
                  <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    <svg className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-2.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 5.5Zm0 6.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" clipRule="evenodd" />
                    </svg>
                    <span>Sélectionne une heure de début pour continuer.</span>
                  </p>
                ) : dateStart && startTime && !durationHours ? (
                  <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    <svg className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-2.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 5.5Zm0 6.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" clipRule="evenodd" />
                    </svg>
                    <span>Sélectionne une durée pour continuer.</span>
                  </p>
                ) : null}

              </div>
            ) : null}

            {/* Lieu de garde */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <p className="text-sm font-semibold text-slate-900">Lieu de garde</p>
              <p className="mt-1 text-sm text-slate-600">Où se déroulera la prestation ?</p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={locationMode === "AT_SITTER"}
                  onClick={() => { setLocationMode("AT_SITTER"); setTravelPreview(null); setTravelError(null); }}
                  className={
                    locationMode === "AT_SITTER"
                      ? "flex items-center gap-3 rounded-2xl border border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] px-4 py-3 text-left text-sm font-semibold text-[var(--dogshift-blue)]"
                      : "flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  }
                >
                  <MapPin className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p>Chez le sitter</p>
                    <p className="text-xs font-normal opacity-70">Vous vous déplacez — sans frais</p>
                  </div>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={locationMode === "AT_OWNER"}
                  disabled={!sitter.hasAddress}
                  onClick={() => { if (sitter.hasAddress) setLocationMode("AT_OWNER"); }}
                  title={!sitter.hasAddress ? "Ce sitter n'a pas encore renseigné son adresse" : undefined}
                  className={
                    locationMode === "AT_OWNER"
                      ? "flex items-center gap-3 rounded-2xl border border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] px-4 py-3 text-left text-sm font-semibold text-[var(--dogshift-blue)]"
                      : sitter.hasAddress
                        ? "flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                        : "flex cursor-not-allowed items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-400"
                  }
                >
                  <Home className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p>Chez moi</p>
                    <p className="text-xs font-normal opacity-70">
                      {sitter.hasAddress ? `${TRAVEL_RATE_CHF_PER_KM} CHF/km · max. ${MAX_TRAVEL_RADIUS_KM} km` : "Adresse du sitter manquante"}
                    </p>
                  </div>
                </button>
              </div>

              {locationMode === "AT_OWNER" && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Votre adresse</p>

                  {/* Rue + numéro */}
                  <input
                    id="owner_street"
                    value={ownerStreet}
                    onChange={(e) => setOwnerStreet(e.target.value)}
                    placeholder="Rue et numéro — ex. Rue du Rhône 12"
                    autoComplete="address-line1"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                  />

                  {/* NPA + Ville côte à côte */}
                  <div className="flex gap-2">
                    <input
                      id="owner_npa"
                      value={ownerNpa}
                      onChange={(e) => setOwnerNpa(e.target.value)}
                      placeholder="NPA — ex. 1204"
                      autoComplete="postal-code"
                      maxLength={10}
                      className="w-28 shrink-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                    />
                    <div className="relative flex-1">
                      <input
                        id="owner_city"
                        value={ownerCity}
                        onChange={(e) => setOwnerCity(e.target.value)}
                        placeholder="Ville — ex. Genève"
                        autoComplete="address-level2"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                      />
                      {geocodingAddress && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                        </div>
                      )}
                    </div>
                  </div>

                  {travelError && (
                    <p className="text-sm font-medium text-rose-600">{travelError}</p>
                  )}
                  {travelPreview && !travelError && (
                    <p className="text-sm text-emerald-700">
                      ✓ {travelPreview.distanceKm.toFixed(1)} km · frais de déplacement :{" "}
                      <span className="font-semibold">CHF {travelPreview.feeChf.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Number of dogs picker — shown when sitter has a maxDogs limit */}
            {sitter.acceptanceCriteria?.maxDogs != null && sitter.acceptanceCriteria.maxDogs > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
                <p className="text-sm font-semibold text-slate-900">Nombre de chiens</p>
                <p className="mt-1 text-xs text-slate-500">
                  Ce sitter accepte au maximum {sitter.acceptanceCriteria.maxDogs} chien{sitter.acceptanceCriteria.maxDogs > 1 ? "s" : ""} simultanément.
                </p>
                {sitter.acceptanceCriteria.neuteredRequired && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600">
                    <Scissors className="h-3 w-3 flex-shrink-0" />
                    Chiens castrés/stérilisés uniquement.
                  </p>
                )}
                <div className="mt-4 flex items-center gap-4">
                  <button
                    type="button"
                    aria-label="Diminuer"
                    disabled={numberOfDogs <= 1}
                    onClick={() => setNumberOfDogs((n) => Math.max(1, n - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-lg font-bold text-slate-900">{numberOfDogs}</span>
                  <button
                    type="button"
                    aria-label="Augmenter"
                    disabled={numberOfDogs >= sitter.acceptanceCriteria.maxDogs}
                    onClick={() => setNumberOfDogs((n) => Math.min(sitter.acceptanceCriteria!.maxDogs!, n + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Neutered-only notice (when no maxDogs limit set) */}
            {sitter.acceptanceCriteria?.neuteredRequired && !sitter.acceptanceCriteria?.maxDogs && (
              <div className="flex items-start gap-2 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                Ce sitter accepte uniquement les chiens castrés ou stérilisés.
              </div>
            )}

            {/* Dog picker + phone */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <p className="text-sm font-semibold text-slate-900">Votre chien</p>
              <p className="mt-1 text-sm text-slate-500">Le sitter recevra la fiche complète de votre chien dans sa notification.</p>

              {dogsLoading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--dogshift-blue)] border-t-transparent" />
                  Chargement…
                </div>
              ) : dogs.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4">
                  <p className="text-sm text-slate-600">Vous n&apos;avez pas encore ajouté de chien.</p>
                  <a
                    href="/account/dogs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-[var(--dogshift-blue)] underline underline-offset-2"
                  >
                    Ajouter mon chien →
                  </a>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  {dogs.map((dog) => {
                    const isSelected = selectedDogIds.includes(dog.id);
                    const dogSizeKey = dogSizeKeyFromWeight(dog.weightKg);
                    const pensionSizes = sitter.pensionAcceptedSizes ?? [];
                    const isPension = selectedService === "Pension";
                    const sizeBlocked = isPension && pensionSizes.length > 0 && dogSizeKey !== null && !pensionSizes.includes(dogSizeKey);
                    const photoSrc = dog.photoUrl ? publicDogPhotoPath(dog.photoUrl) : null;
                    return (
                      <button
                        key={dog.id}
                        type="button"
                        onClick={() => {
                          setSelectedDogIds((prev) => {
                            const next = prev.includes(dog.id)
                              ? prev.filter((id) => id !== dog.id)
                              : [...prev, dog.id];
                            // Update dog size to reflect the first selected dog
                            const firstId = next[0] ?? null;
                            const firstDog = dogs.find((d) => d.id === firstId);
                            const sk = firstDog ? dogSizeKeyFromWeight(firstDog.weightKg) : null;
                            if (sk) setDogSize(sk);
                            return next;
                          });
                        }}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          sizeBlocked
                            ? "border-rose-200 bg-rose-50 opacity-70"
                            : isSelected
                              ? "border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] text-[var(--dogshift-blue)]"
                              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        {/* Checkbox */}
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                          isSelected
                            ? "border-[var(--dogshift-blue)] bg-[var(--dogshift-blue)]"
                            : sizeBlocked
                              ? "border-rose-300 bg-white"
                              : "border-slate-300 bg-white"
                        }`}>
                          {isSelected && (
                            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        {/* Photo or initial */}
                        {photoSrc ? (
                          <img
                            src={photoSrc}
                            alt={dog.name}
                            className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${isSelected ? "bg-[var(--dogshift-blue)]/20 text-[var(--dogshift-blue)]" : sizeBlocked ? "bg-rose-100 text-rose-400" : "bg-slate-100 text-slate-500"}`}>
                            {dog.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-tight">{dog.name}</p>
                          <p className="text-[11px] leading-tight opacity-70">
                            {[
                              dog.breed,
                              dog.weightKg ? `${dog.weightKg} kg` : null,
                              dogSizeKey ? DOG_SIZE_WEIGHTS[dogSizeKey].label : null,
                            ].filter(Boolean).join(" · ")}
                            {sizeBlocked && <span className="ml-1 font-semibold text-rose-500">— taille non acceptée</span>}
                            {isPension && !dog.weightKg && <span className="ml-1 font-semibold text-amber-600">— poids manquant, compléter la fiche</span>}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900">Votre numéro de téléphone</p>
                <p className="mt-0.5 text-xs text-slate-500">Partagé avec le sitter pour faciliter la coordination.</p>
                <input
                  type="tel"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+41 79 123 45 67"
                  autoComplete="tel"
                  className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                />
              </div>
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
                <div className="mt-4 border-t border-slate-200 pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-6 text-sm">
                    <p className="text-slate-600">Sous-total</p>
                    <p className="text-right font-semibold text-slate-900">
                      {summary ? `CHF ${summary.subtotal.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  {summary && summary.travelFeeChf > 0 ? (
                    <div className="flex items-start justify-between gap-6 text-sm">
                      <p className="text-slate-600">Déplacement</p>
                      <p className="text-right font-semibold text-slate-900">
                        CHF {summary.travelFeeChf.toFixed(2)}
                      </p>
                    </div>
                  ) : null}
                  {summary && summary.travelFeeChf > 0 ? (
                    <div className="flex items-start justify-between gap-6 border-t border-slate-200 pt-2 text-sm">
                      <p className="font-semibold text-slate-900">Total</p>
                      <p className="text-right font-semibold text-slate-900">
                        CHF {summary.total.toFixed(2)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}

              {recapCancellationVariant ? (
                <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-600">
                  {recapCancellationVariant === "lastMinute" ? (
                    <>
                      <span className="font-semibold text-slate-800">Dernière minute : </span>
                      après paiement, confirmation immédiate ; somme non remboursable sauf si le dogsitter annule.
                    </>
                  ) : (
                    <>
                      Annulation gratuite jusqu’à 24h avant la prestation ; passé ce délai, non remboursable sauf si le dogsitter
                      annule.
                    </>
                  )}
                </p>
              ) : null}

              <button type="button" disabled={submitting} onClick={() => void onContinue()} className={`mt-6 ${PRIMARY_BTN}`}>
                {submitting ? "Redirection…" : "Continuer"}
              </button>

              {selectedService === "Pension" && !dogsLoading && dogs.length === 0 && (
                <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <svg className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-2.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 5.5Zm0 6.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" clipRule="evenodd" />
                  </svg>
                  <span>La pension nécessite une fiche chien.{" "}
                    <a href="/account/dogs" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
                      Ajouter mon chien →
                    </a>
                  </span>
                </p>
              )}

              <p className="mt-3 text-xs text-slate-500">
                Le montant final est calculé au moment de la réservation.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile Sticky CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {(error ?? disabledReason) && (
          <p className={`px-4 pt-3 text-center text-xs font-medium ${error ? "text-rose-600" : "text-slate-400"}`}>
            {error ?? disabledReason}
          </p>
        )}
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">Total : CHF {summary ? summary.total.toFixed(2) : "—"}</p>
            <p className="truncate text-xs text-slate-600">
              {summary?.quantityLabel || "Service à définir"}
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onContinue()}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Redirection…" : "Continuer"}
          </button>
        </div>
      </div>
    </div>
  );
}
