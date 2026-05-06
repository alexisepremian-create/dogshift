"use client";

import { useCallback, useMemo, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getServiceColors } from "@/lib/design/services";

// ── Shared calendar utilities ──────────────────────────────────────────────────

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

const WEEK_FR = ["L","M","M","J","V","S","D"];

function calendarDays(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const pad = (firstDow + 6) % 7;
  return [...Array(pad).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isDatePast(year: number, month: number, day: number): boolean {
  const today = new Date();
  return new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function isToday(year: number, month: number, day: number): boolean {
  const t = new Date();
  return year === t.getFullYear() && month === t.getMonth() && day === t.getDate();
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ServiceType = "PROMENADE" | "DOGSITTING" | "PENSION";

export type DayAvailability = {
  date: string;
  promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
  dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
  pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
  promenadePartial?: boolean;
  dogsittingPartial?: boolean;
  pensionPartial?: boolean;
};

export type CalendarProps = {
  variant: "search" | "profile";

  /** "single" = click selects one date. "range" = click selects start then end. */
  mode: "single" | "range";

  /** Current year+month to display */
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;

  /** Selection state */
  selectedStart: string | null;
  selectedEnd: string | null;
  onDateSelect: (iso: string) => void;

  /** Hover state for range preview (search variant) */
  hoverDate?: string | null;
  onHoverDate?: (iso: string | null) => void;

  /** Profile variant: service availability dots */
  availability?: Map<string, DayAvailability>;
  activeService?: ServiceType;

  /** Minimum selectable date (ISO) — dates before this are disabled */
  minDate?: string;
};

// ── Component ──────────────────────────────────────────────────────────────────

function CalendarMonth({
  year,
  month,
  variant,
  mode,
  selectedStart,
  selectedEnd,
  onDateSelect,
  hoverDate,
  onHoverDate,
  availability,
  activeService,
  minDate,
  showHeader = true,
}: {
  year: number;
  month: number;
  showHeader?: boolean;
} & Omit<CalendarProps, "year" | "month" | "onMonthChange">) {
  const days = useMemo(() => calendarDays(year, month), [year, month]);

  const effectiveEnd = mode === "single"
    ? null
    : (selectedEnd ?? (selectedStart && hoverDate && hoverDate > selectedStart ? hoverDate : null));

  const inRange = useCallback((iso: string) =>
    !!(selectedStart && effectiveEnd && iso > selectedStart && iso < effectiveEnd),
  [selectedStart, effectiveEnd]);

  const isRangeStart = useCallback((iso: string) =>
    iso === selectedStart && !!effectiveEnd && effectiveEnd !== selectedStart,
  [selectedStart, effectiveEnd]);

  const isRangeEnd = useCallback((iso: string) =>
    iso === effectiveEnd && !!selectedStart && effectiveEnd !== selectedStart,
  [selectedStart, effectiveEnd]);

  const isEdge = useCallback((iso: string) =>
    iso === selectedStart || iso === effectiveEnd,
  [selectedStart, effectiveEnd]);

  return (
    <div>
      {showHeader && (
        <p className="mb-2 text-center text-sm font-semibold text-slate-900">
          {MONTHS_FR[month]} {year}
        </p>
      )}

      <div className="mb-1.5 grid grid-cols-7">
        {WEEK_FR.map((d, i) => (
          <span key={i} className="block text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso = toISO(year, month, day);
          const past = isDatePast(year, month, day) || (minDate ? iso < minDate : false);
          const tod = isToday(year, month, day);
          const edge = isEdge(iso);
          const rStart = isRangeStart(iso);
          const rEnd = isRangeEnd(iso);
          const rIn = inRange(iso);
          const selected = iso === selectedStart && mode === "single";

          if (variant === "search") {
            return (
              <div
                key={i}
                className={[
                  "relative flex h-10 items-center justify-center",
                  rIn ? "bg-slate-100" : "",
                  rStart ? "rounded-l-full bg-gradient-to-r from-white via-slate-100 to-slate-100" : "",
                  rEnd ? "rounded-r-full bg-gradient-to-l from-white via-slate-100 to-slate-100" : "",
                ].filter(Boolean).join(" ")}
              >
                <button
                  type="button"
                  disabled={past}
                  onClick={() => !past && onDateSelect(iso)}
                  onMouseEnter={() => onHoverDate?.(iso)}
                  onMouseLeave={() => onHoverDate?.(null)}
                  className={[
                    "relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all duration-100",
                    past ? "cursor-not-allowed text-slate-200 opacity-40" : "cursor-pointer",
                    edge || selected ? "bg-slate-900 font-semibold text-white" : "",
                    !edge && !selected && !past ? "hover:bg-slate-200" : "",
                    tod && !edge && !selected ? "font-bold text-[var(--dogshift-blue)]" : "",
                  ].filter(Boolean).join(" ")}
                  aria-label={`${day} ${MONTHS_FR[month]} ${year}`}
                >
                  {day}
                </button>
              </div>
            );
          }

          // ── Profile variant ──
          const row = availability?.get(iso);
          const serviceTone = getStatusForService(row, activeService ?? "PROMENADE");
          const servicePartial = getPartialForService(row, activeService ?? "PROMENADE");
          const isSelectable = !past && (serviceTone === "AVAILABLE" || serviceTone === "ON_REQUEST" || servicePartial);

          const availDots: string[] = [];
          if (!past && row) {
            if ((row.promenadeStatus === "AVAILABLE" || row.promenadeStatus === "ON_REQUEST" || row.promenadePartial))
              availDots.push(getServiceColors("PROMENADE").fill);
            if ((row.dogsittingStatus === "AVAILABLE" || row.dogsittingStatus === "ON_REQUEST" || row.dogsittingPartial))
              availDots.push(getServiceColors("DOGSITTING").fill);
            if ((row.pensionStatus === "AVAILABLE" || row.pensionStatus === "ON_REQUEST" || row.pensionPartial))
              availDots.push(getServiceColors("PENSION").fill);
          }

          let btnClass = "relative flex h-10 w-10 sm:h-11 sm:w-11 flex-col items-center justify-center rounded-full text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2";

          if (past) {
            btnClass += " text-slate-300 cursor-not-allowed opacity-40";
          } else if (edge) {
            btnClass += " bg-slate-900 text-white shadow-sm";
          } else if (rIn) {
            btnClass += " bg-slate-100 text-slate-900";
          } else if (isSelectable) {
            btnClass += " bg-white text-slate-700 hover:bg-slate-100";
          } else {
            btnClass += " text-slate-300";
          }

          if (tod && !edge) {
            btnClass += " ring-2 ring-[var(--dogshift-blue)] ring-offset-1";
          }

          return (
            <div key={i} className={[
              "flex items-center justify-center py-0.5",
              rIn ? "bg-slate-100" : "",
              rStart ? "rounded-l-full bg-gradient-to-r from-transparent to-slate-100" : "",
              rEnd ? "rounded-r-full bg-gradient-to-l from-transparent to-slate-100" : "",
            ].filter(Boolean).join(" ")}>
              <button
                type="button"
                disabled={!isSelectable}
                onClick={() => isSelectable && onDateSelect(iso)}
                className={btnClass}
                aria-label={`${iso}`}
                aria-pressed={edge}
              >
                <span className={availDots.length > 0 && !edge && !rIn ? "-translate-y-0.5" : ""}>{day}</span>
                {availDots.length > 0 && !edge && !rIn ? (
                  <div className="absolute bottom-1 flex gap-0.5">
                    {availDots.map((dotColor, idx) => (
                      <span key={idx} className={`h-1 w-1 rounded-full ${dotColor}`} />
                    ))}
                  </div>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MemoizedCalendarMonth = memo(CalendarMonth);

export default function Calendar(props: CalendarProps) {
  const {
    variant,
    year,
    month,
    onMonthChange,
    ...rest
  } = props;

  const todayDate = new Date();
  const canGoPrev = !(year === todayDate.getFullYear() && month === todayDate.getMonth());

  const prevMonth = useCallback(() => {
    if (!canGoPrev) return;
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  }, [canGoPrev, month, onMonthChange, year]);

  const nextMonth = useCallback(() => {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  }, [month, onMonthChange, year]);

  const monthLabel = `${MONTHS_FR[month]} ${year}`;

  if (variant === "search") {
    const rightMonth = month === 11 ? 0 : month + 1;
    const rightYear = month === 11 ? year + 1 : year;

    return (
      <div>
        <div className="flex items-center justify-between px-2 mb-3">
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <MemoizedCalendarMonth year={year} month={month} variant={variant} {...rest} />
          <MemoizedCalendarMonth year={rightYear} month={rightMonth} variant={variant} {...rest} showHeader />
        </div>
      </div>
    );
  }

  // Profile variant: single month with navigation
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold capitalize text-slate-900">{monthLabel}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <MemoizedCalendarMonth year={year} month={month} variant={variant} showHeader={false} {...rest} />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getStatusForService(
  row: DayAvailability | undefined,
  serviceType: ServiceType,
): "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE" {
  if (!row) return "UNAVAILABLE";
  if (serviceType === "PROMENADE") return row.promenadeStatus;
  if (serviceType === "DOGSITTING") return row.dogsittingStatus;
  return row.pensionStatus;
}

function getPartialForService(
  row: DayAvailability | undefined,
  serviceType: ServiceType,
): boolean {
  if (!row) return false;
  if (serviceType === "PROMENADE") return Boolean(row.promenadePartial);
  if (serviceType === "DOGSITTING") return Boolean(row.dogsittingPartial);
  return Boolean(row.pensionPartial);
}

// Re-export utilities for use by search bar
export { MONTHS_FR, WEEK_FR, calendarDays, toISO, isDatePast, isToday };
