"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileText,
  Handshake,
  Lock,
  MapPin,
  Navigation,
  Search,
  Shield,
  ShieldCheck,
  Umbrella,
  UserCheck,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MapPreview from "@/components/MapPreview";
import SitterCard, { type SitterPreview } from "@/components/ui/SitterCard";

// ── HOOKS ─────────────────────────────────────────────────────────────────────

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(Boolean(mql.matches));
    onChange();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    mql.addListener(onChange);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return () => mql.removeListener(onChange);
  }, []);
  return reduced;
}

function useRevealOnce({ repeat = false } = {}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setRevealed(true);
          if (!repeat) obs.disconnect();
        } else if (repeat) {
          setRevealed(false);
        }
      },
      { threshold: 0.14 },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  const style = prefersReducedMotion
    ? undefined
    : {
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(8px)",
        transition:
          "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)",
      };

  return { ref, style };
}

function useStaggerReveal(count: number, { baseDelay = 0, step = 80, repeat = false } = {}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setRevealed(true);
          if (!repeat) obs.disconnect();
        } else if (repeat) {
          setRevealed(false);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  function itemStyle(index: number): React.CSSProperties {
    if (prefersReducedMotion) return {};
    const delay = baseDelay + index * step;
    return {
      opacity: revealed ? 1 : 0,
      transform: revealed ? "translateY(0)" : "translateY(8px)",
      transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    };
  }

  void count;
  return { ref, itemStyle };
}

// ── SMART SEARCH BAR ──────────────────────────────────────────────────────────

type ServiceKey = "Promenade" | "Garde" | "Pension";

const SERVICE_TABS: { key: ServiceKey; label: string }[] = [
  { key: "Promenade", label: "Promenade" },
  { key: "Garde", label: "Dogsitting" },
  { key: "Pension", label: "Pension" },
];

// Promenade — slotEngine: min 60 min, max 180 min, step 30 min
const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: "1h",   label: "1 heure" },
  { value: "1h30", label: "1 h 30" },
  { value: "2h",   label: "2 heures" },
  { value: "2h30", label: "2 h 30" },
  { value: "3h",   label: "3 heures" },
];

// Garde/Dogsitting — slotEngine: min 120 min, max 720 min, step 15 min (UI: practical 30-60 min steps)
const GARDE_DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: "2h",   label: "2 heures" },
  { value: "2h30", label: "2 h 30" },
  { value: "3h",   label: "3 heures" },
  { value: "4h",   label: "4 heures" },
  { value: "5h",   label: "5 heures" },
  { value: "6h",   label: "6 heures" },
  { value: "8h",   label: "8 heures" },
  { value: "10h",  label: "10 heures" },
  { value: "12h",  label: "12 heures" },
];

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const WEEK_FR = ["L","M","M","J","V","S","D"];
const TIMES: string[] = [];
for (let h = 7; h <= 21; h++) {
  TIMES.push(`${String(h).padStart(2,"0")}:00`);
  if (h < 21) TIMES.push(`${String(h).padStart(2,"0")}:30`);
}

function formatDateShort(d: string): string {
  if (!d) return "";
  const parts = d.split("-");
  const m = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  return `${day} ${(MONTHS_FR[m] ?? "").slice(0, 3).toLowerCase()}.`;
}

function calendarDays(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const result: (number | null)[] = Array(offset).fill(null);
  for (let i = 1; i <= dim; i++) result.push(i);
  return result;
}

function isDatePast(year: number, month: number, day: number): boolean {
  const today = new Date();
  return new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function isToday(year: number, month: number, day: number): boolean {
  const t = new Date();
  return year === t.getFullYear() && month === t.getMonth() && day === t.getDate();
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

// ── DATE PICKER (portal-based) ────────────────────────────────────────────────

function DatePickerField({
  label,
  placeholder,
  value,
  onChange,
  minDate,
  alignRight = false,
  onMouseEnter,
  onMouseLeave,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  alignRight?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bodyMounted, setBodyMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const today = new Date();
  const [vy, setVy] = useState(today.getFullYear());
  const [vm, setVm] = useState(today.getMonth());

  useEffect(() => { setBodyMounted(true); }, []);

  const POPOVER_W = 360;

  const computePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = alignRight ? r.right - POPOVER_W : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_W - 8));
    setPos({ top: r.bottom + 8, left });
  }, [alignRight]);

  useEffect(() => {
    if (!open) return;
    computePos();
    window.addEventListener("scroll", computePos, { passive: true });
    window.addEventListener("resize", computePos);
    return () => {
      window.removeEventListener("scroll", computePos);
      window.removeEventListener("resize", computePos);
    };
  }, [open, computePos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const days = calendarDays(vy, vm);

  const popover = open && bodyMounted
    ? createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Choisir ${label.toLowerCase()}`}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: POPOVER_W }}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_28px_80px_-20px_rgba(2,6,23,0.28),0_4px_16px_-8px_rgba(2,6,23,0.10)]"
        >
          {/* Month navigation */}
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (vm === 0) { setVm(11); setVy((y) => y - 1); }
                else setVm((m) => m - 1);
              }}
              disabled={vy === today.getFullYear() && vm === today.getMonth()}
              aria-label="Mois précédent"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-base font-semibold text-slate-900">
              {MONTHS_FR[vm]} {vy}
            </span>
            <button
              type="button"
              onClick={() => {
                if (vm === 11) { setVm(0); setVy((y) => y + 1); }
                else setVm((m) => m + 1);
              }}
              aria-label="Mois suivant"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Week day headers */}
          <div className="mb-2 grid grid-cols-7">
            {WEEK_FR.map((d, i) => (
              <span key={i} className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-300">
                {d}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((day, i) => {
              if (!day) return <span key={i} />;
              const iso = toISO(vy, vm, day);
              const past = isDatePast(vy, vm, day) || (minDate ? iso < minDate : false);
              const sel = iso === value;
              const tod = isToday(vy, vm, day);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={past}
                  onClick={() => { onChange(iso); setOpen(false); }}
                  className={[
                    "mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all",
                    sel
                      ? "bg-[var(--dogshift-blue)] text-white shadow-sm"
                      : "",
                    !sel && tod
                      ? "ring-2 ring-[var(--dogshift-blue)] text-[var(--dogshift-blue)]"
                      : "",
                    !sel && !tod && !past
                      ? "cursor-pointer text-slate-700 hover:bg-slate-100"
                      : "",
                    past ? "cursor-not-allowed text-slate-300" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {value && (
            <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-700"
              >
                Effacer la date
              </button>
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div
      className="flex flex-col justify-center rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-slate-100/60"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left outline-none"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className={`mt-0.5 block text-[15px] font-medium ${value ? "text-slate-900" : "text-slate-400"}`}>
          {value ? formatDateShort(value) : placeholder}
        </span>
      </button>
      {popover}
    </div>
  );
}

// ── DATE RANGE PICKER (easyJet-style, portal-based, double month) ─────────────

function DateRangeField({
  label = "Dates",
  startDate,
  endDate,
  onChange,
  onMouseEnter,
  onMouseLeave,
}: {
  label?: string;
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bodyMounted, setBodyMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const today = new Date();
  const [vy, setVy] = useState(today.getFullYear());
  const [vm, setVm] = useState(today.getMonth());
  const rightVm = vm === 11 ? 0 : vm + 1;
  const rightVy = vm === 11 ? vy + 1 : vy;

  useEffect(() => { setBodyMounted(true); }, []);

  const POPOVER_W = 340;

  const computePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_W - 8));
    setPos({ top: r.bottom + 8, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePos();
    window.addEventListener("scroll", computePos, { passive: true });
    window.addEventListener("resize", computePos);
    return () => {
      window.removeEventListener("scroll", computePos);
      window.removeEventListener("resize", computePos);
    };
  }, [open, computePos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleDayClick(iso: string) {
    if (!startDate || (startDate && endDate)) {
      onChange(iso, "");
    } else if (iso < startDate) {
      onChange(iso, "");
    } else if (iso === startDate) {
      onChange("", "");
    } else {
      onChange(startDate, iso);
      setOpen(false);
    }
  }

  // Effective range end — preview with hover when only start is selected
  const effectiveEnd = endDate || (startDate && hoverDate && hoverDate > startDate ? hoverDate : null);

  function renderMonth(year: number, month: number) {
    const days = calendarDays(year, month);
    return (
      <div className="min-w-0 flex-1">
        <p className="mb-4 text-center text-sm font-semibold text-slate-800">
          {MONTHS_FR[month]} {year}
        </p>
        <div className="mb-1.5 grid grid-cols-7">
          {WEEK_FR.map((d, i) => (
            <span key={i} className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-300">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            if (!day) return <span key={idx} />;
            const iso = toISO(year, month, day);
            const past = isDatePast(year, month, day);
            const isStart = iso === startDate;
            const isEnd = effectiveEnd ? iso === effectiveEnd : false;
            const isPreview = !endDate && isEnd; // hover preview end
            const inRange = !!(startDate && effectiveEnd && iso > startDate && iso < effectiveEnd);
            const tod = isToday(year, month, day);
            // range bg: left half for end, right half for start, full for in-range
            const rangeBg = inRange ? "bg-blue-50" : "";
            const startBg = isStart && effectiveEnd ? "bg-blue-50" : "";
            const endBg = isEnd && startDate ? "bg-blue-50" : "";
            // half-cell masking
            const startHalf = isStart && effectiveEnd; // show right half only
            const endHalf = isEnd && startDate; // show left half only

            return (
              <div key={idx} className="relative flex h-10 items-center justify-center">
                {/* Range band background */}
                {(inRange || startHalf || endHalf) && (
                  <div
                    className={[
                      "absolute inset-y-0.5",
                      rangeBg || startBg || endBg,
                      startHalf ? "left-1/2 right-0" : endHalf ? "left-0 right-1/2" : "inset-x-0",
                    ].filter(Boolean).join(" ")}
                  />
                )}
                {/* Day button */}
                <button
                  type="button"
                  disabled={past}
                  onClick={() => handleDayClick(iso)}
                  onMouseEnter={() => !endDate && setHoverDate(iso)}
                  onMouseLeave={() => setHoverDate(null)}
                  className={[
                    "relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all duration-150",
                    isStart || (isEnd && !isPreview)
                      ? "bg-[var(--dogshift-blue)] text-white shadow-sm"
                      : "",
                    isPreview
                      ? "bg-[var(--dogshift-blue)]/70 text-white"
                      : "",
                    !isStart && !isEnd && tod
                      ? "ring-2 ring-[var(--dogshift-blue)] text-[var(--dogshift-blue)]"
                      : "",
                    !isStart && !isEnd && !past
                      ? "cursor-pointer text-slate-700 hover:bg-blue-50"
                      : "",
                    past ? "cursor-not-allowed text-slate-300" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {day}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Display in trigger
  const displayValue = startDate && endDate
    ? `${formatDateShort(startDate)} → ${formatDateShort(endDate)}`
    : startDate
    ? `${formatDateShort(startDate)} → …`
    : "";

  const hint = !startDate
    ? "Choisissez l'arrivée"
    : !endDate
    ? "Choisissez le départ"
    : null;

  const popover = open && bodyMounted
    ? createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Choisir les dates"
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: POPOVER_W }}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_28px_80px_-20px_rgba(2,6,23,0.28),0_4px_16px_-8px_rgba(2,6,23,0.10)]"
        >
          {/* Nav + hint */}
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (vm === 0) { setVm(11); setVy((y) => y - 1); }
                else setVm((m) => m - 1);
              }}
              disabled={vy === today.getFullYear() && vm === today.getMonth()}
              aria-label="Mois précédent"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {hint && (
              <span className="text-xs font-medium text-slate-400">{hint}</span>
            )}
            <button
              type="button"
              onClick={() => {
                if (vm === 11) { setVm(0); setVy((y) => y + 1); }
                else setVm((m) => m + 1);
              }}
              aria-label="Mois suivant"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Single month */}
          {renderMonth(vy, vm)}

          {/* Footer */}
          {(startDate || endDate) && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-500">
                {startDate && endDate
                  ? `${formatDateShort(startDate)} → ${formatDateShort(endDate)}`
                  : startDate
                  ? `Arrivée : ${formatDateShort(startDate)} — départ ?`
                  : ""}
              </span>
              <button
                type="button"
                onClick={() => { onChange("", ""); }}
                className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-700"
              >
                Effacer
              </button>
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div
      className="flex flex-col justify-center rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-slate-100/60"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left outline-none"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className={`mt-0.5 block text-[15px] font-medium ${displayValue ? "text-slate-900" : "text-slate-400"}`}>
          {displayValue || "Arrivée → Départ"}
        </span>
      </button>
      {popover}
    </div>
  );
}

// ── TIME PICKER (portal-based) ────────────────────────────────────────────────

function TimePickerField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [bodyMounted, setBodyMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => { setBodyMounted(true); }, []);

  const POPOVER_W = 192;

  const computePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_W - 8));
    setPos({ top: r.bottom + 8, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePos();
    window.addEventListener("scroll", computePos, { passive: true });
    window.addEventListener("resize", computePos);
    return () => {
      window.removeEventListener("scroll", computePos);
      window.removeEventListener("resize", computePos);
    };
  }, [open, computePos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Scroll selected time into view
  useEffect(() => {
    if (!open || !value || !popoverRef.current) return;
    const t = setTimeout(() => {
      const sel = popoverRef.current?.querySelector(`[data-t="${value}"]`) as HTMLElement | null;
      sel?.scrollIntoView({ block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [open, value]);

  const popover = open && bodyMounted
    ? createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          aria-label={label}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: POPOVER_W }}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_28px_80px_-20px_rgba(2,6,23,0.28),0_4px_16px_-8px_rgba(2,6,23,0.10)]"
        >
          <div className="max-h-64 overflow-y-auto py-2 [scrollbar-width:thin]">
            {TIMES.map((t) => (
              <button
                key={t}
                data-t={t}
                type="button"
                role="option"
                aria-selected={t === value}
                onClick={() => { onChange(t); setOpen(false); }}
                className={[
                  "flex w-full items-center px-5 py-3 text-sm font-medium transition-colors",
                  t === value
                    ? "bg-[color-mix(in_srgb,var(--dogshift-blue),transparent_88%)] font-semibold text-[var(--dogshift-blue)]"
                    : "text-slate-700 hover:bg-slate-50",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="flex flex-col justify-center px-5 py-4">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className={`mt-0.5 block text-[15px] font-medium ${value ? "text-slate-900" : "text-slate-400"}`}>
          {value || placeholder}
        </span>
      </button>
      {popover}
    </div>
  );
}

// ── SMART SEARCH BAR (MAIN) ───────────────────────────────────────────────────

function SmartSearchBar({ onSearch }: { onSearch?: () => void } = {}) {
  const router = useRouter();
  const [service, setService] = useState<ServiceKey>("Promenade");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState("1h");

  // Reset duration to a valid default when switching service
  function switchService(s: ServiceKey) {
    setService(s);
    setError("");
    if (s === "Garde") setDuration("2h");
    else if (s === "Promenade") setDuration("1h");
  }
  const [arrivalDate, setArrivalDate] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [nbDogs, setNbDogs] = useState(1);
  const [error, setError] = useState("");
  const [hoveredField, setHoveredField] = useState<string | null>(null);

  function handleSearch() {
    if (!location.trim()) {
      setError("Indiquez un lieu de prise en charge.");
      return;
    }
    const p = new URLSearchParams({ service, location: location.trim() });
    if (service === "Pension") {
      // Pension: daily range — arrival / departure
      if (arrivalDate) p.set("arrival", arrivalDate);
      if (departureDate) p.set("departure", departureDate);
    } else {
      // Promenade + Garde: hourly — single date + duration
      if (date) p.set("date", date);
      if (duration) p.set("duration", duration);
    }
    if (nbDogs > 1) p.set("dogs", String(nbDogs));
    onSearch?.();
    router.push(`/search?${p.toString()}`);
  }

  // Promenade + Garde are hourly; only Pension is daily range
  const isHourly = service === "Promenade" || service === "Garde";
  const isPension = service === "Pension";
  // Duration options depend on service
  const activeDurationOptions = service === "Garde" ? GARDE_DURATION_OPTIONS : DURATION_OPTIONS;

  return (
    <div className="w-full">
      {/* Service tabs */}
      <div className="mb-3 flex items-center gap-1 sm:gap-1.5">
        {SERVICE_TABS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => switchService(s.key)}
            className={
              service === s.key
                ? "rounded-full px-4 py-2 text-sm font-semibold bg-[var(--dogshift-blue)] text-white shadow-sm transition-all duration-200"
                : "rounded-full px-4 py-2 text-sm font-medium border border-slate-200 bg-white/90 text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-white hover:text-slate-900"
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Search card */}
      <form
        aria-label="Recherche de dogsitter"
        onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
        className={[
          "flex flex-col rounded-2xl border border-slate-200/80 bg-white",
          "shadow-[0_8px_32px_-8px_rgba(2,6,23,0.12),0_2px_8px_-4px_rgba(2,6,23,0.06)]",
          "transition-shadow duration-300 focus-within:shadow-[0_16px_48px_-12px_rgba(2,6,23,0.18)]",
          "p-1.5 md:flex-row md:items-stretch",
        ].join(" ")}
      >
        {/* Lieu */}
        <div
          className="flex min-w-0 flex-1 flex-col justify-center rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-slate-100/60"
          onMouseEnter={() => setHoveredField("lieu")}
          onMouseLeave={() => setHoveredField(null)}
        >
          <label htmlFor="sb-lieu" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Où
          </label>
          <input
            id="sb-lieu"
            placeholder="Lausanne, Genève, Montreux…"
            value={location}
            autoComplete="off"
            onChange={(e) => { setLocation(e.target.value); setError(""); }}
            className="mt-0.5 block w-full bg-transparent text-[15px] font-medium text-slate-900 placeholder:text-slate-400 outline-none"
          />
        </div>

        {/* Sep: lieu / date */}
        <div className={`hidden md:block w-px shrink-0 self-stretch my-2 bg-slate-200 transition-opacity duration-150 ${hoveredField === "lieu" || hoveredField === "date" || hoveredField === "arrivee" ? "opacity-0" : ""}`} aria-hidden="true" />
        <div className="h-px bg-slate-100 mx-2 md:hidden" aria-hidden="true" />

        {isHourly ? (
          /* ── PROMENADE : date unique + durée ── */
          <>
            <DatePickerField
              label="Date"
              placeholder="Choisissez"
              value={date}
              onChange={setDate}
              onMouseEnter={() => setHoveredField("date")}
              onMouseLeave={() => setHoveredField(null)}
            />
            {/* Sep: date / durée */}
            <div className={`hidden md:block w-px shrink-0 self-stretch my-2 bg-slate-200 transition-opacity duration-150 ${hoveredField === "date" || hoveredField === "duree" ? "opacity-0" : ""}`} aria-hidden="true" />
            <div className="h-px bg-slate-100 mx-2 md:hidden" aria-hidden="true" />
            {/* Durée (Promenade : 1h–3h) */}
            <div
              className="flex flex-col justify-center rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-slate-100/60 md:w-36"
              onMouseEnter={() => setHoveredField("duree")}
              onMouseLeave={() => setHoveredField(null)}
            >
              <label htmlFor="sb-dur" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Durée
              </label>
              <div className="relative mt-0.5">
                <select
                  id="sb-dur"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="block w-full appearance-none bg-transparent pr-5 text-[15px] font-medium text-slate-900 outline-none"
                >
                  {activeDurationOptions.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              </div>
            </div>
          </>
        ) : (
          /* ── GARDE + PENSION : plage de dates via range picker ── */
          <DateRangeField
            label={isPension ? "Dates du séjour" : "Dates"}
            startDate={arrivalDate}
            endDate={departureDate}
            onChange={(start, end) => { setArrivalDate(start); setDepartureDate(end); }}
            onMouseEnter={() => setHoveredField("arrivee")}
            onMouseLeave={() => setHoveredField(null)}
          />
        )}

        {/* Sep: [last date/durée/range] / chiens */}
        <div className={`hidden md:block w-px shrink-0 self-stretch my-2 bg-slate-200 transition-opacity duration-150 ${hoveredField === "duree" || hoveredField === "arrivee" || hoveredField === "chiens" ? "opacity-0" : ""}`} aria-hidden="true" />
        <div className="h-px bg-slate-100 mx-2 md:hidden" aria-hidden="true" />

        {/* Nb chiens */}
        <div
          className="flex flex-col justify-center rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-slate-100/60 md:w-32"
          onMouseEnter={() => setHoveredField("chiens")}
          onMouseLeave={() => setHoveredField(null)}
        >
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Chiens</span>
          <div className="mt-1.5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setNbDogs(Math.max(1, nbDogs - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-sm leading-none text-slate-600 transition-colors hover:border-slate-300 hover:bg-white active:scale-95"
              aria-label="Moins"
            >
              −
            </button>
            <span className="min-w-[1.5rem] text-center text-[15px] font-medium text-slate-900">{nbDogs}</span>
            <button
              type="button"
              onClick={() => setNbDogs(Math.min(4, nbDogs + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-sm leading-none text-slate-600 transition-colors hover:border-slate-300 hover:bg-white active:scale-95"
              aria-label="Plus"
            >
              +
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-center p-1.5 pl-0">
          <button
            type="submit"
            aria-label="Lancer la recherche"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--dogshift-blue)] text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_70%)] transition-all duration-200 hover:bg-[var(--dogshift-blue-hover)] hover:shadow-[0_8px_24px_-8px_rgba(47,77,107,0.55)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="mt-2 text-center text-xs font-medium text-red-600/90">{error}</p>
      ) : null}
    </div>
  );
}

// ── HERO SECTION ──────────────────────────────────────────────────────────────

// ── SEARCH PANEL (Airbnb-style two-column desktop panel) ──────────────────────

type PanelDateFlex = 0 | 1 | 2 | 3 | 7;
type PanelFlexDuration = "week-end" | "semaine" | "mois";

const DATE_FLEX_OPTIONS: { value: PanelDateFlex; label: string }[] = [
  { value: 0, label: "Dates exactes" },
  { value: 1, label: "±1 jour" },
  { value: 2, label: "±2 jours" },
  { value: 3, label: "±3 jours" },
  { value: 7, label: "±7 jours" },
];

const FLEX_DURATION_OPTIONS: { key: PanelFlexDuration; label: string; emoji: string }[] = [
  { key: "week-end", label: "Week-end", emoji: "🌅" },
  { key: "semaine", label: "Semaine", emoji: "🌿" },
  { key: "mois", label: "Mois", emoji: "🗓️" },
];

// Suggestions de lieu — icône, titre, sous-titre
const LOCATION_SUGGESTIONS: {
  Icon: React.ElementType;
  label: string;
  sublabel: string;
}[] = [
  { Icon: Navigation, label: "À proximité", sublabel: "Selon votre position" },
  { Icon: MapPin, label: "Lausanne", sublabel: "Vaud · Suisse" },
  { Icon: MapPin, label: "Genève", sublabel: "Genève · Lac Léman" },
  { Icon: MapPin, label: "Montreux", sublabel: "Riviera vaudoise" },
  { Icon: MapPin, label: "Vevey", sublabel: "Riviera vaudoise" },
  { Icon: MapPin, label: "Nyon", sublabel: "Vaud · Région lémanique" },
  { Icon: MapPin, label: "Fribourg", sublabel: "Fribourg · Suisse" },
];

// SearchPanel removed — logic inlined in StickySearchBar below
// ── STICKY SEARCH BAR (3-section Airbnb-style bar + floating card) ───────────

// ── Dog size icons — sourced from /public SVG files, inlined for currentColor ──

// Petit — dog-side.svg (minimal side silhouette)
function DogSmall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m19 3l-4 4l3 3l1-1l1 1l2-2l-3-3V3M3 7L2 8l3 3v3l-1 1v6h2v-3l2-3h7v6h2V11l-3-3l-1 1H5L3 7Z" />
    </svg>
  );
}

// Moyen — dog (1).svg (mid-complexity icon)
function DogMedium({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M3.348 6.007c-.026 0-.058.014-.086.017l.031-.03L.025 3.965l-.014.597l1.5 2.46c-.277.341-.473.706-.473.988v4.908H3v-1.655l2.98-1.334h3.019l.667 2.989h1.252v-5.59l-1.007-1.32H3.348v-.001zm10.404-2.384l-.416-1.385l-2.655 2.622l1.329 1.383l2.81.604l1.192-.872l-2.26-2.352z" />
    </svg>
  );
}

// Grand — dog.svg (detailed FontAwesome-style icon)
function DogLarge({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 576 512" fill="currentColor" aria-hidden="true">
      <path d="m309.6 158.5l23.1-138.7C334.6 8.4 344.5 0 356.1 0c7.5 0 14.5 3.5 19 9.5L392 32h52.1c12.7 0 24.9 5.1 33.9 14.1L496 64h56c13.3 0 24 10.7 24 24v24c0 44.2-35.8 80-80 80h-69.3l-5.1 30.5l-112-64zM416 256.1V480c0 17.7-14.3 32-32 32h-32c-17.7 0-32-14.3-32-32V364.8c-24 12.3-51.2 19.2-80 19.2s-56-6.9-80-19.2V480c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V249.8c-28.8-10.9-51.4-35.3-59.2-66.5L1 167.8c-4.3-17.1 6.1-34.5 23.3-38.8s34.5 6.1 38.8 23.3l3.9 15.5C70.5 182 83.3 192 98 192h205.8L416 256.1zM464 80a16 16 0 1 0-32 0a16 16 0 1 0 32 0z" />
    </svg>
  );
}

const DOG_SIZES = [
  { key: "petit", label: "Petit", sub: "< 10 kg",  Icon: DogSmall,  iconCls: "w-9 h-9" },
  { key: "moyen", label: "Moyen", sub: "10–25 kg", Icon: DogMedium, iconCls: "w-10 h-10" },
  { key: "grand", label: "Grand", sub: "> 25 kg",  Icon: DogLarge,  iconCls: "w-12 h-12" },
] as const;
type DogSizeKey = typeof DOG_SIZES[number]["key"];

type StickySection = "lieu" | "quand" | "besoin";

function StickySearchBar({ visible = true, hero = false }: { visible?: boolean; hero?: boolean }) {
  const router = useRouter();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // ── Active section (Airbnb 3-section bar) ──
  const [activeSection, setActiveSection] = useState<StickySection | null>(null);
  const [bodyMounted, setBodyMounted] = useState(false);

  // ── Refs ──
  const wrapperRef = useRef<HTMLDivElement>(null); // bar + floating card container (click-outside)
  const barRef    = useRef<HTMLDivElement>(null);
  const lieuRef   = useRef<HTMLButtonElement>(null);
  const quandRef  = useRef<HTMLButtonElement>(null);
  const besoinRef = useRef<HTMLButtonElement>(null);
  const [pillLeft, setPillLeft] = useState(0);
  const [pillWidth, setPillWidth] = useState(0);
  const [pillVisible, setPillVisible] = useState(false);

  // ── Form state ──
  const [service, setService] = useState<ServiceKey>("Promenade");
  const [location, setLocation] = useState("");
  const [locationError, setLocationError] = useState("");
  const [calTab, setCalTab] = useState<"dates" | "flexible">("dates");
  const [dogSize, setDogSize] = useState<DogSizeKey | null>(null);

  // ── Dates ──
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [dateFlex, setDateFlex] = useState<PanelDateFlex>(0);

  // ── Flexible mode ──
  const [flexDuration, setFlexDuration] = useState<PanelFlexDuration | null>(null);
  const [flexMonths, setFlexMonths] = useState<Set<string>>(new Set());

  // ── Calendar nav ──
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const rightCalMonth = calMonth === 11 ? 0 : calMonth + 1;
  const rightCalYear = calMonth === 11 ? calYear + 1 : calYear;
  const canGoPrev = !(calYear === today.getFullYear() && calMonth === today.getMonth());

  // ── Besoin ──
  const [nbDogs, setNbDogs] = useState(1);
  const [duration, setDuration] = useState("1h");

  // ── Derived ──
  const isHourly = service === "Promenade" || service === "Garde";
  const durationOptions = service === "Garde" ? GARDE_DURATION_OPTIONS : DURATION_OPTIONS;
  const upcomingMonths = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { key, year: d.getFullYear(), month: d.getMonth() };
  });

  // ── Display labels for bar sections ──
  const dateDisplay = startDate
    ? (endDate ? `${formatDateShort(startDate)} – ${formatDateShort(endDate)}` : formatDateShort(startDate))
    : null;
  const dogSizeLabel = dogSize ? DOG_SIZES.find((d) => d.key === dogSize)?.label : null;
  const besoinDisplay = [
    `${nbDogs} chien${nbDogs > 1 ? "s" : ""}`,
    dogSizeLabel,
    isHourly ? durationOptions.find((d) => d.value === duration)?.label : null,
  ].filter(Boolean).join(" · ");

  useEffect(() => { setBodyMounted(true); }, []);
  useEffect(() => { if (!visible) setActiveSection(null); }, [visible]);
  // (body scroll-lock removed — floating card doesn't need it and it caused layout shifts)
  useEffect(() => {
    if (service === "Garde") setDuration("2h");
    else if (service === "Promenade") setDuration("1h");
  }, [service]);
  // ── Keyboard: Escape closes ──
  useEffect(() => {
    if (!activeSection) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActiveSection(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeSection]);

  // ── Click outside: reliable pointerdown capture on document ──
  useEffect(() => {
    if (!activeSection) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setActiveSection(null);
      }
    };
    // capture phase catches the event before bubbling; avoids missing events in portals
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [activeSection]);

  // ── Sliding pill: compute position after layout has fully settled ──
  // Uses double-RAF so the measurement happens after pending compositing/layout
  // work (e.g. float-card-enter animation frame) is complete. This ensures
  // the pill covers the section button correctly on both first click and return.
  useEffect(() => {
    if (!activeSection) {
      setPillVisible(false);
      return;
    }
    const refMap: Record<StickySection, React.RefObject<HTMLButtonElement | null>> = {
      lieu: lieuRef, quand: quandRef, besoin: besoinRef,
    };

    let raf1: number;
    let raf2: number;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = refMap[activeSection]?.current;
        const bar = barRef.current;
        if (!el || !bar) return;
        const barRect = bar.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setPillLeft(elRect.left - barRect.left);
        setPillWidth(elRect.width);
        setPillVisible(true);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeSection]);

  // ── Helper aliases for readability ──
  const isHourlyPanel = isHourly;
  const panelDurationOptions = durationOptions;

  function prevMonth() {
    if (!canGoPrev) return;
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  function handleDayClick(iso: string) {
    if (isHourlyPanel) {
      // Promenade: single date only (no range)
      setStartDate(iso === startDate ? null : iso);
      setEndDate(null);
      return;
    }
    // Garde + Pension: date range
    if (!startDate || (startDate && endDate)) {
      setStartDate(iso); setEndDate(null);
    } else if (iso < startDate) {
      setStartDate(iso); setEndDate(null);
    } else if (iso === startDate) {
      setStartDate(null); setEndDate(null);
    } else {
      setEndDate(iso);
    }
  }

  const effectiveEnd = isHourlyPanel
    ? null // no range for Promenade
    : (endDate ?? (startDate && hoverDate && hoverDate > startDate ? hoverDate : null));

  function inRange(iso: string) {
    return !!(startDate && effectiveEnd && iso > startDate && iso < effectiveEnd);
  }
  function isRangeEdge(iso: string) { return iso === startDate || iso === (endDate ?? effectiveEnd); }
  function isRangeStart(iso: string) { return iso === startDate && !!effectiveEnd && effectiveEnd !== startDate; }
  function isRangeEnd(iso: string) { return iso === effectiveEnd && !!startDate && effectiveEnd !== startDate; }

  function toggleFlexMonth(key: string) {
    setFlexMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Quick picks — preset date shortcuts
  function applyWeekend() {
    const d = new Date(today);
    const daysToSat = ((6 - d.getDay()) + 7) % 7 || 7;
    const sat = new Date(d); sat.setDate(d.getDate() + daysToSat);
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    setStartDate(toISO(sat.getFullYear(), sat.getMonth(), sat.getDate()));
    setEndDate(toISO(sun.getFullYear(), sun.getMonth(), sun.getDate()));
    setCalTab("dates");
  }
  function applyNextWeek() {
    const d = new Date(today);
    const daysToMon = ((1 - d.getDay()) + 7) % 7 || 7;
    const mon = new Date(d); mon.setDate(d.getDate() + daysToMon);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    setStartDate(toISO(mon.getFullYear(), mon.getMonth(), mon.getDate()));
    setEndDate(toISO(sun.getFullYear(), sun.getMonth(), sun.getDate()));
    setCalTab("dates");
  }
  function applyTomorrow() {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    setStartDate(toISO(d.getFullYear(), d.getMonth(), d.getDate()));
    setEndDate(null);
    setCalTab("dates");
  }
  function applyRecurrent() {
    setFlexDuration("semaine");
    setCalTab("flexible");
  }

  function handleSearch() {
    if (!location.trim()) {
      setLocationError("Indiquez une ville avant de rechercher.");
      setActiveSection("lieu");
      return;
    }
    setLocationError("");
    const p = new URLSearchParams({ service, location: location.trim() });
    if (isHourlyPanel) {
      if (calTab === "dates") {
        if (startDate) p.set("date", startDate);
        if (dateFlex > 0) p.set("flex", String(dateFlex));
      } else {
        if (flexDuration) p.set("flexDuration", flexDuration);
        if (flexMonths.size > 0) p.set("flexMonths", [...flexMonths].join(","));
      }
      if (duration) p.set("duration", duration);
    } else {
      if (calTab === "dates") {
        if (startDate) p.set("arrival", startDate);
        if (endDate) p.set("departure", endDate);
        if (dateFlex > 0) p.set("flex", String(dateFlex));
      } else {
        if (flexDuration) p.set("flexDuration", flexDuration);
        if (flexMonths.size > 0) p.set("flexMonths", [...flexMonths].join(","));
      }
    }
    if (nbDogs > 1) p.set("dogs", String(nbDogs));
    setActiveSection(null);
    router.push(`/search?${p.toString()}`);
  }

  // Render one calendar month (called as function, not component, to avoid re-mount)
  function renderCalMonth(year: number, month: number) {
    const days = calendarDays(year, month);
    return (
      <div>
        <p className="mb-2 text-center text-[13px] font-semibold text-slate-900 sm:mb-4 sm:text-sm">
          {MONTHS_FR[month]} {year}
        </p>
        <div className="mb-1 grid grid-cols-7 sm:mb-1.5">
          {WEEK_FR.map((d, i) => (
            <span key={i} className="block text-center text-[10px] font-bold uppercase tracking-wider text-slate-300">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day) return <div key={i} />;
            const iso = toISO(year, month, day);
            const past = isDatePast(year, month, day);
            const edge = isRangeEdge(iso);
            const rStart = isRangeStart(iso);
            const rEnd = isRangeEnd(iso);
            const rIn = inRange(iso);
            const tod = isToday(year, month, day);

            return (
              <div
                key={i}
                className={[
                  "relative flex h-8 items-center justify-center sm:h-10",
                  rIn ? "bg-slate-100" : "",
                  rStart ? "rounded-l-full bg-gradient-to-r from-white via-slate-100 to-slate-100" : "",
                  rEnd ? "rounded-r-full bg-gradient-to-l from-white via-slate-100 to-slate-100" : "",
                ].filter(Boolean).join(" ")}
              >
                <button
                  type="button"
                  disabled={past}
                  onClick={() => !past && handleDayClick(iso)}
                  onMouseEnter={() => { if (startDate && !endDate) setHoverDate(iso); }}
                  onMouseLeave={() => setHoverDate(null)}
                  className={[
                    "relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs transition-all duration-100 sm:h-9 sm:w-9 sm:text-sm",
                    past ? "cursor-not-allowed text-slate-200" : "cursor-pointer",
                    edge ? "bg-slate-900 font-semibold text-white" : "",
                    !edge && !past ? "hover:bg-slate-200" : "",
                    tod && !edge ? "font-bold text-[var(--dogshift-blue)]" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {day}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Size tokens: hero vs compact ──
  const sz = hero ? {
    wrapPad:   "py-0",
    maxW:      "max-w-4xl",
    gap:       "gap-1 sm:gap-2",
    px:        "px-4 sm:px-0",
    btnPad:    "px-3.5 py-3 sm:px-7 sm:py-[22px]",
    labelCls:  "text-[10px] sm:text-xs font-bold uppercase tracking-wider",
    valueCls:  "text-[13px] sm:text-[15px] font-semibold leading-snug",
    pillShadow: "shadow-[0_16px_48px_-12px_rgba(2,6,23,0.20),0_4px_16px_-4px_rgba(2,6,23,0.08)]",
    divMy:     "my-2 sm:my-3",
    searchPad: "px-3.5 py-2.5 sm:px-5 sm:py-[18px]",
    searchTxt: "text-sm sm:text-[15px] font-semibold",
  } : {
    wrapPad:   "py-2 sm:py-3 md:py-4",
    maxW:      "max-w-3xl",
    gap:       "gap-1 sm:gap-1.5",
    px:        "px-6 sm:px-8 lg:px-10",
    btnPad:    "px-3 py-2.5 sm:px-5 sm:py-3.5",
    labelCls:  "text-[9px] sm:text-[10px] font-bold uppercase tracking-wider",
    valueCls:  "text-xs sm:text-sm font-medium leading-tight",
    pillShadow: "shadow-[0_6px_28px_-8px_rgba(2,6,23,0.16),0_1px_4px_-1px_rgba(2,6,23,0.06)]",
    divMy:     "my-1.5 sm:my-2.5",
    searchPad: "px-3 py-2 sm:px-4 sm:py-3.5",
    searchTxt: "text-xs sm:text-sm font-semibold",
  };

  // ── Shared style helpers ──
  const sectionLabel = "mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400";
  const pillBase = "rounded-full border px-3 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-all duration-150";
  const pillActive = `${pillBase} border-slate-900 bg-white ring-1 ring-slate-900/10 font-semibold text-slate-900`;
  const pillIdle = `${pillBase} border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700`;

  // Card width adapts to content per section
  const cardWidth = activeSection === "quand" ? 680 : activeSection === "besoin" ? 460 : 420;

  return (
    <>
      {/* ── Visual dimming backdrop (purely decorative — click-outside handled by pointerdown listener) ── */}
      {bodyMounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[38] pointer-events-none transition-all duration-400"
              style={{
                background: activeSection ? "rgba(2,6,23,0.14)" : "transparent",
                backdropFilter: activeSection ? "blur(1.5px)" : "none",
              }}
              aria-hidden="true"
            />,
            document.body,
          )
        : null}

      {/* ── Container: sticky wrapper OR normal-flow hero ── */}
      {hero ? null : (
        // The ghost wrapper that captures pointer events outside the bar when active
        <div 
          className="fixed inset-0 z-30 pointer-events-auto" 
          style={{ display: activeSection ? "block" : "none" }}
          onClick={() => setActiveSection(null)}
        />
      )}
      <div
        ref={wrapperRef}
        aria-hidden={hero ? undefined : !visible}
        className={hero
          ? "relative z-[45]"
          : [
              "fixed left-0 right-0 z-40 w-full transition-all duration-400 ease-out origin-top",
              visible ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95",
            ].join(" ")
        }
        style={hero ? undefined : { top: "calc(max(env(safe-area-inset-top), 12px) + 12px)" }}
      >
        <div className={sz.wrapPad}>
          <div className={`mx-auto flex ${sz.maxW} items-center ${sz.gap} ${sz.px}`}>
            <div
              ref={barRef}
              className={`relative flex min-w-0 flex-1 items-stretch overflow-hidden rounded-full border border-slate-200/90 bg-slate-100 ${sz.pillShadow}`}
            >
                {/*
                  ── Sliding pill — animation layer only ──
                  The active button owns its own bg-white (always correct size).
                  This pill is purely decorative: it provides the cross-section slide
                  animation. No shadow here (button carries the shadow).
                */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-1 rounded-full bg-white"
                  style={{
                    left: pillLeft,
                    width: pillWidth,
                    opacity: pillVisible ? 1 : 0,
                    transition: "left 380ms cubic-bezier(0.34, 1.15, 0.64, 1), width 380ms cubic-bezier(0.34, 1.15, 0.64, 1), opacity 180ms ease",
                  }}
                />

                {/* — Section 1: Lieu — */}
                <button
                  ref={lieuRef}
                  type="button"
                  onClick={() => { setActiveSection(activeSection === "lieu" ? null : "lieu"); }}
                  className={[
                    `relative z-10 flex min-w-0 flex-1 sm:flex-[1.4] flex-col justify-center rounded-[28px] ${sz.btnPad} text-left transition-all duration-200 focus-visible:outline-none`,
                    activeSection === "lieu"
                      ? "bg-white shadow-[0_2px_12px_-3px_rgba(2,6,23,0.10)]"
                      : locationError
                        ? "bg-red-100/80 ring-1 ring-inset ring-red-300/60"
                        : "hover:bg-white/50",
                  ].join(" ")}
                >
                  <span className={`${sz.labelCls} leading-none text-slate-400`}>
                    <span className="hidden sm:inline">Lieu de prise en charge</span>
                    <span className="sm:hidden">Lieu</span>
                  </span>
                  <span className={`mt-1 truncate ${sz.valueCls} ${location ? "text-slate-900" : "text-slate-500"}`}>
                    {location || (
                      <>
                        <span className="hidden sm:inline">Lausanne, Genève…</span>
                        <span className="sm:hidden">Lausanne…</span>
                      </>
                    )}
                  </span>
                </button>

                {/* divider — fades when straddled by active section */}
                <div
                  className={`shrink-0 self-stretch ${sz.divMy} w-px bg-slate-300/60 transition-opacity duration-300`}
                  style={{ opacity: activeSection === "lieu" || activeSection === "quand" ? 0 : 1 }}
                  aria-hidden="true"
                />

                {/* — Section 2: Quand — */}
                <button
                  ref={quandRef}
                  type="button"
                  onClick={() => setActiveSection(activeSection === "quand" ? null : "quand")}
                  className={[
                    `relative z-10 flex min-w-0 flex-1 flex-col justify-center rounded-[28px] ${sz.btnPad} text-left transition-all duration-200 focus-visible:outline-none`,
                    activeSection === "quand"
                      ? "bg-white shadow-[0_2px_12px_-3px_rgba(2,6,23,0.10)]"
                      : "hover:bg-white/50",
                  ].join(" ")}
                >
                  <span className={`${sz.labelCls} text-slate-400 leading-none`}>Quand ?</span>
                  <span className={`mt-1 truncate ${sz.valueCls} ${dateDisplay ? "text-slate-900" : "text-slate-500"}`}>
                    {dateDisplay || (
                      <>
                        <span className="hidden sm:inline">Ajouter des dates</span>
                        <span className="sm:hidden">Ajouter</span>
                      </>
                    )}
                  </span>
                </button>

                {/* divider */}
                <div
                  className={`shrink-0 self-stretch ${sz.divMy} w-px bg-slate-300/60 transition-opacity duration-300`}
                  style={{ opacity: activeSection === "quand" || activeSection === "besoin" ? 0 : 1 }}
                  aria-hidden="true"
                />

                {/* — Section 3: Service — */}
                <button
                  ref={besoinRef}
                  type="button"
                  onClick={() => setActiveSection(activeSection === "besoin" ? null : "besoin")}
                  className={[
                    `relative z-10 flex min-w-0 flex-1 flex-col justify-center rounded-[28px] ${sz.btnPad} text-left transition-all duration-200 focus-visible:outline-none`,
                    activeSection === "besoin"
                      ? "bg-white shadow-[0_2px_12px_-3px_rgba(2,6,23,0.10)]"
                      : "hover:bg-white/50",
                  ].join(" ")}
                >
                  <span className={`${sz.labelCls} text-slate-400 leading-none`}>Service</span>
                  <span className={`mt-1 truncate ${sz.valueCls} text-slate-900`}>{besoinDisplay}</span>
                </button>
              </div>

              {/* ── Search button ── */}
              <button
                type="button"
                onClick={handleSearch}
                className={`flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 ${sz.searchPad} ${sz.searchTxt} text-white shadow-[0_4px_16px_-4px_rgba(2,6,23,0.35)] transition-all duration-200 hover:scale-[1.03] hover:bg-slate-800 hover:shadow-[0_8px_24px_-6px_rgba(2,6,23,0.40)] active:scale-95`}
              >
                <Search className={hero ? "h-4 w-4 sm:h-5 sm:w-5" : "h-3.5 w-3.5 sm:h-4 sm:w-4"} aria-hidden="true" />
                <span className="hidden sm:block">Rechercher</span>
              </button>
            </div>
          </div>
          {locationError && (
            <p role="alert" className="mt-2 text-center text-xs font-medium text-red-500 animate-in fade-in slide-in-from-top-1 duration-200">
              {locationError}
            </p>
          )}

          {/* ═══ FLOATING CARD ═══ */}
          {activeSection && (
            /*
              pointer-events-none on the full-width outer wrapper so that clicks in the
              transparent left/right gutters fall through to the page content.
              The document pointerdown listener then catches them as "outside" and closes.
              pointer-events-auto is restored on the inner card so it stays interactive.
            */
            <div className="pointer-events-none absolute left-0 right-0 top-full z-10 flex justify-center px-6 pt-2 sm:px-8 sm:pt-2.5">
              <div
                className="pointer-events-auto float-card-enter overflow-hidden rounded-3xl bg-white shadow-[0_32px_72px_-20px_rgba(2,6,23,0.22),0_6px_20px_-8px_rgba(2,6,23,0.10)]"
                style={{
                  width: `min(${cardWidth}px, calc(100vw - 48px))`,
                  transition: "width 420ms cubic-bezier(0.34, 1.1, 0.64, 1)",
                }}
              >
                <div key={activeSection} className="panel-tab-enter">

                  {/* ──────────────── SECTION LIEU ──────────────── */}
                  {activeSection === "lieu" && (
                    <div className="p-4">
                      {/* Input */}
                      <div className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--dogshift-blue)]/30 bg-white px-3.5 py-2.5 shadow-sm ring-2 ring-[var(--dogshift-blue)]/10">
                        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <input
                          value={location}
                            onChange={(e) => { setLocation(e.target.value); setLocationError(""); }}
                          placeholder="Lausanne, Genève, Montreux…"
                          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
                          autoComplete="off"
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                        />
                        {location && (
                          <button
                            type="button"
                            onClick={() => setLocation("")}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      {/* Suggestions */}
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Suggestions</p>
                      {LOCATION_SUGGESTIONS
                        .filter((s) => !location || s.label.toLowerCase().startsWith(location.toLowerCase()))
                        .slice(0, 5)
                        .map(({ Icon, label, sublabel }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => { setLocation(label); setLocationError(""); setActiveSection("quand"); }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors duration-100 hover:bg-slate-50"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                              <Icon className="h-3 w-3 text-slate-500" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{label}</p>
                              <p className="text-[11px] text-slate-400">{sublabel}</p>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}

                  {/* ──────────────── SECTION QUAND ──────────────── */}
                  {activeSection === "quand" && (
                    <div className="p-4 sm:p-5">
                      {/* Date / Flexible tabs */}
                      <div className="mb-3 flex justify-center sm:mb-4">
                        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)]">
                          {(["dates", "flexible"] as const).map((t) => (
                            <button key={t} type="button" onClick={() => setCalTab(t)}
                              className={calTab === t
                                ? "rounded-full bg-white px-4 py-1 text-[11px] font-semibold text-slate-900 shadow-sm transition-all duration-200 sm:px-5 sm:py-1.5 sm:text-xs"
                                : "rounded-full px-4 py-1 text-[11px] font-medium text-slate-500 transition-all duration-200 hover:text-slate-700 sm:px-5 sm:py-1.5 sm:text-xs"
                              }>
                              {t === "dates" ? (isHourlyPanel ? "Date précise" : "Dates précises") : "Flexible"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {calTab === "dates" ? (
                        <div key="dates" className="panel-tab-enter">
                          {/* Calendar nav */}
                          <div className="mb-2 flex items-center justify-between px-0.5 sm:mb-3">
                            <button type="button" onClick={prevMonth} disabled={!canGoPrev}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-20 sm:h-8 sm:w-8">
                              <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                            </button>
                            <button type="button" onClick={nextMonth}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 sm:h-8 sm:w-8">
                              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                            </button>
                          </div>
                          {/* Double calendar */}
                          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                            {renderCalMonth(calYear, calMonth)}
                            <div className="hidden sm:block">
                              {renderCalMonth(rightCalYear, rightCalMonth)}
                            </div>
                          </div>
                          {/* Flexibility pills — Pension only */}
                          {!isHourlyPanel && (
                            <div className="mt-3 border-t border-slate-100 pt-2.5 sm:mt-4 sm:pt-3">
                              <div className="mb-1.5 flex items-center justify-between sm:mb-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Flexibilité</p>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-500 sm:px-2.5 sm:text-[10px]">
                                  Nuit obligatoire · 08h–19h
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {DATE_FLEX_OPTIONS.map((opt) => (
                                  <button key={opt.value} type="button" onClick={() => setDateFlex(opt.value)}
                                    className={dateFlex === opt.value ? pillActive : pillIdle}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Next → Besoin */}
                          <div className="mt-3 flex items-center justify-between sm:mt-4">
                            {isHourlyPanel && (
                              <p className="text-[11px] text-slate-400">
                                Durée dans{" "}
                                <button onClick={() => setActiveSection("besoin")} className="font-semibold text-[var(--dogshift-blue)] hover:underline">
                                  Service
                                </button>
                              </p>
                            )}
                            <button onClick={() => setActiveSection("besoin")}
                              className="ml-auto flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-slate-700 sm:px-4 sm:py-2 sm:text-xs">
                              Suivant <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key="flexible" className="panel-tab-enter">
                          {/* Duration cards */}
                          <div className="mb-3 sm:mb-4">
                            <p className={sectionLabel}>{isHourlyPanel ? "Durée souhaitée" : "Durée du séjour"}</p>
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                              {FLEX_DURATION_OPTIONS.map((opt) => (
                                <button key={opt.key} type="button" onClick={() => setFlexDuration(opt.key)}
                                  className={[
                                    "group flex flex-col items-center gap-1.5 rounded-xl border py-2 transition-all duration-200 sm:py-3",
                                    flexDuration === opt.key
                                      ? "border-slate-900 bg-white shadow-md ring-2 ring-slate-900/10"
                                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm",
                                  ].join(" ")}>
                                  <span className={`text-lg leading-none transition-transform duration-200 sm:text-xl ${flexDuration !== opt.key ? "group-hover:scale-110" : ""}`}>
                                    {opt.emoji}
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-800 sm:text-xs">{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Month chips */}
                          <div>
                            <p className={sectionLabel}>{isHourlyPanel ? "Quel mois ?" : "Quand partir ?"}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {upcomingMonths.map(({ key, year, month }) => {
                                const sel = flexMonths.has(key);
                                return (
                                  <button key={key} type="button" onClick={() => toggleFlexMonth(key)}
                                    className={[
                                      "group flex items-center gap-1.5 rounded-xl border px-2 py-1 transition-all duration-150 sm:px-2.5 sm:py-1.5",
                                      sel
                                        ? "border-slate-900 bg-white shadow-sm ring-1 ring-slate-900/10"
                                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm",
                                    ].join(" ")}>
                                    <Calendar className={`h-3 w-3 shrink-0 transition-colors duration-150 ${sel ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600"}`} aria-hidden="true" />
                                    <span className={`text-[11px] font-medium transition-colors duration-150 sm:text-xs ${sel ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                                      {MONTHS_FR[month].slice(0, 4)}
                                      {year !== today.getFullYear() && <span className="ml-1 text-[9px] text-slate-400 sm:text-[10px]">{year}</span>}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end sm:mt-4">
                            <button onClick={() => setActiveSection("besoin")}
                              className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-slate-700 sm:px-4 sm:py-2 sm:text-xs">
                              Suivant <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ──────────────── SECTION BESOIN ──────────────── */}
                  {activeSection === "besoin" && (
                    <div className="p-4">
                      {/* Service */}
                      <div className="mb-3">
                        <p className={sectionLabel}>Service</p>
                        <div className="flex flex-wrap gap-1.5">
                          {SERVICE_TABS.map((s) => (
                            <button key={s.key} type="button" onClick={() => setService(s.key)}
                              className={service === s.key ? pillActive : pillIdle}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Durée (hourly only) */}
                      {isHourlyPanel && (
                        <div className="mb-3">
                          <label htmlFor="sb-dur" className={sectionLabel}>
                            {service === "Garde" ? "Durée de la garde" : "Durée de la promenade"}
                          </label>
                          <div className="relative rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 transition-colors focus-within:border-[var(--dogshift-blue)]/40 focus-within:bg-white">
                            <select
                              id="sb-dur"
                              value={duration}
                              onChange={(e) => setDuration(e.target.value)}
                              className="block w-full appearance-none bg-transparent pr-6 text-sm font-medium text-slate-900 outline-none"
                            >
                              {panelDurationOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                          </div>
                        </div>
                      )}

                      {/* Chiens — nombre (inline) */}
                      <div className="mb-3 flex items-center justify-between">
                        <p className={sectionLabel}>Chiens</p>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setNbDogs(Math.max(1, nbDogs - 1))} aria-label="Moins"
                            disabled={nbDogs <= 1}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-30">
                            −
                          </button>
                          <span className="min-w-[1.5rem] text-center text-sm font-semibold text-slate-900">{nbDogs}</span>
                          <button type="button" onClick={() => setNbDogs(Math.min(4, nbDogs + 1))} aria-label="Plus"
                            disabled={nbDogs >= 4}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-sm text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-30">
                            +
                          </button>
                        </div>
                      </div>

                      {/* Taille du chien — icônes silhouette premium */}
                      <div>
                        <p className={sectionLabel}>Taille du chien</p>
                        <div className="grid grid-cols-3 gap-2">
                          {DOG_SIZES.map(({ key, label, sub, Icon, iconCls }) => {
                            const active = dogSize === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setDogSize(active ? null : key)}
                                className={[
                                  "group flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition-all duration-300",
                                  active
                                    ? "border-slate-800 bg-white shadow-[0_4px_16px_-4px_rgba(2,6,23,0.14)] ring-2 ring-slate-800/10"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-sm",
                                ].join(" ")}
                              >
                                <Icon
                                  className={`${iconCls} transition-colors duration-250 ${active ? "text-slate-800" : "text-slate-300 group-hover:text-slate-500"}`}
                                />
                                <div className="text-center leading-snug">
                                  <p className={`text-[11px] font-semibold tracking-wide transition-colors duration-200 ${active ? "text-slate-900" : "text-slate-600"}`}>
                                    {label}
                                  </p>
                                  <p className="text-[10px] text-slate-400">{sub}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>
    </>
  );
}

// ── HERO SECTION ──────────────────────────────────────────────────────────────


const HERO_TRUST_ITEMS = [
  { icon: BadgeCheck, label: "Profils vérifiés" },
  { icon: ShieldCheck, label: "Casier judiciaire vierge" },
  { icon: Shield, label: "Assurance RC incluse" },
  { icon: Lock, label: "Paiement sécurisé" },
] as const;

function HeroSection() {
  return (
    <section className="relative bg-gradient-to-b from-slate-50 to-white pt-20 pb-6 sm:pt-14 sm:pb-8">
      {/* Ambient glow — clipped to its own container so it doesn't leak */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--dogshift-blue)] opacity-[0.05] blur-[90px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-0">
        {/* Headline */}
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="text-balance text-[1.6rem] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[2.1rem] md:text-[2.6rem] md:leading-[1.1]">
            Trouvez un dogsitter de confiance{" "}
            <span className="text-[var(--dogshift-blue)]">près de chez vous</span>
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500 sm:text-[15px]">
            Promenade, dogsitting ou pension — profils vérifiés, réservation simple.
          </p>
        </div>

        {/* Hero search bar — same premium pill as the sticky bar, hero-sized */}
        <StickySearchBar hero />

        {/* Reassurance row */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-x-7">
          {HERO_TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500 sm:text-xs">
              <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--dogshift-blue)]/70" aria-hidden="true" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// ── QUICK CATEGORY TILES ──────────────────────────────────────────────────────

const QUICK_TILES = [
  {
    icon: MapPin,
    label: "Promenade",
    desc: "Sorties quotidiennes",
    href: "/search?service=Promenade",
    iconClass: "text-sky-600",
    bgClass: "bg-sky-50 ring-sky-200/80",
  },
  {
    icon: UserCheck,
    label: "Dogsitting",
    desc: "Garde à domicile",
    href: "/search?service=Garde",
    iconClass: "text-violet-600",
    bgClass: "bg-violet-50 ring-violet-200/80",
  },
  {
    icon: Umbrella,
    label: "Pension",
    desc: "Hébergement complet",
    href: "/search?service=Pension",
    iconClass: "text-amber-600",
    bgClass: "bg-amber-50 ring-amber-200/80",
  },
  {
    icon: BadgeCheck,
    label: "Sitters vérifiés",
    desc: "Profils certifiés",
    href: "/search",
    iconClass: "text-emerald-600",
    bgClass: "bg-emerald-50 ring-emerald-200/80",
  },
  {
    icon: Search,
    label: "Voir la carte",
    desc: "Dogsitters proches",
    href: "/search",
    iconClass: "text-[var(--dogshift-blue)]",
    bgClass: "bg-[var(--dogshift-blue-pin)] ring-blue-200/80",
  },
  {
    icon: UserPlus,
    label: "Devenir sitter",
    desc: "Rejoindre DogShift",
    href: "/devenir-dogsitter",
    iconClass: "text-slate-600",
    bgClass: "bg-slate-50 ring-slate-200/80",
  },
] as const;

function QuickCategoryTiles() {
  return (
    <section className="bg-white py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:pb-0 lg:grid-cols-6">
          {QUICK_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.label}
                href={tile.href}
                className="group flex min-w-[118px] shrink-0 flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] sm:min-w-0 sm:shrink"
              >
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${tile.bgClass}`}
                >
                  <Icon className={`h-5 w-5 ${tile.iconClass}`} aria-hidden="true" />
                </span>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-900">{tile.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{tile.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── FEATURED SITTERS ──────────────────────────────────────────────────────────

const CARD_W = 240; // px — base card width in carousel
const CARD_GAP = 14; // px — gap between cards

function SitterCarousel({
  sitters,
  city,
  label: labelOverride,
  isFirst = false,
}: {
  sitters: SitterPreview[];
  city: string;
  label?: string;
  isFirst?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  function slide(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -(CARD_W + CARD_GAP) * 2 : (CARD_W + CARD_GAP) * 2, behavior: "smooth" });
  }

  const label = labelOverride ?? (city ? `Dogsitters à ${city}` : "Profils disponibles");
  const searchHref = city ? `/search?location=${encodeURIComponent(city)}` : "/search";

  return (
    <div className={isFirst ? "relative" : "relative mt-6"}>
      {/* Row header */}
      <div className="mb-3 flex items-center justify-between gap-4 px-6 sm:px-8 lg:px-10">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 sm:text-base">
          {!labelOverride && <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--dogshift-blue)]" aria-hidden="true" />}
          {label}
        </h3>
        <div className="flex items-center gap-2.5">
          <Link
            href={searchHref}
            className="hidden text-xs font-semibold text-[var(--dogshift-blue)] transition-colors hover:text-[var(--dogshift-blue-hover)] sm:inline"
          >
            Tout voir
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => slide("left")}
              disabled={!canLeft}
              aria-label="Précédent"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => slide("right")}
              disabled={!canRight}
              aria-label="Suivant"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth px-6 pb-4 scroll-pl-6 sm:gap-5 sm:px-8 sm:scroll-pl-8 lg:px-10 lg:scroll-pl-10 [-webkit-overflow-scrolling:touch] [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sitters.map((sitter) => (
          <div
            key={sitter.sitterId}
            className="w-[155px] shrink-0 [scroll-snap-align:start] sm:w-[210px]"
          >
            <SitterCard sitter={sitter} />
          </div>
        ))}

        {/* "Voir tout" minimal arrow */}
        <div className="flex shrink-0 items-center [scroll-snap-align:start]">
          <Link
            href={searchHref}
            className="group flex flex-col items-center gap-2 px-2"
            aria-label={city ? `Voir tous les dogsitters à ${city}` : "Voir tous les profils"}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-200 group-hover:border-[var(--dogshift-blue)]/50 group-hover:bg-slate-50 group-hover:text-[var(--dogshift-blue)] group-hover:shadow-md">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-medium text-slate-500 transition-colors group-hover:text-[var(--dogshift-blue)]">
              Voir tout
            </span>
          </Link>
        </div>

        {/* Spacer to guarantee right padding in all mobile browsers */}
        <div className="w-1 shrink-0 sm:w-2" aria-hidden="true" />
      </div>
    </div>
  );
}

function FeaturedSittersSection({ sitters }: { sitters: SitterPreview[] }) {
  const reveal = useRevealOnce({ repeat: true });

  const recentSitters = sitters.slice(0, 8);

  if (sitters.length === 0) return null;

  return (
    <section className="bg-slate-50 py-5 sm:py-7">
      <div className="mx-auto max-w-7xl">
        <div ref={reveal.ref} style={reveal.style} className="mb-4 px-6 sm:px-8 lg:px-10">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            Dogsitters disponibles
          </h2>
        </div>

        {recentSitters.length > 0 && (
          <SitterCarousel
            sitters={recentSitters}
            city=""
            label="Récemment ajoutés"
            isFirst
          />
        )}

        <div className="mt-6 px-6 sm:px-8 lg:px-10">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
          >
            Voir tous les profils
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── REASSURANCE SECTION ───────────────────────────────────────────────────────

const REASSURANCE_ITEMS = [
  {
    icon: BadgeCheck,
    title: "Profils vérifiés",
    desc: "Sélectionnés manuellement avec vérification du casier judiciaire et entretien préalable.",
    iconClass: "text-[var(--dogshift-blue)]",
    iconBg: "bg-[var(--dogshift-blue)]/10 ring-[var(--dogshift-blue)]/20",
  },
  {
    icon: FileCheck,
    title: "Réservation simple",
    desc: "Trouvez, comparez et réservez en quelques clics — sans friction et sans paperasse.",
    iconClass: "text-[var(--dogshift-blue)]",
    iconBg: "bg-[var(--dogshift-blue)]/10 ring-[var(--dogshift-blue)]/20",
  },
  {
    icon: Lock,
    title: "Paiement sécurisé",
    desc: "Paiement en ligne sécurisé via Stripe. Votre argent est protégé jusqu'à la fin de la prestation.",
    iconClass: "text-[var(--dogshift-blue)]",
    iconBg: "bg-[var(--dogshift-blue)]/10 ring-[var(--dogshift-blue)]/20",
  },
  {
    icon: ShieldCheck,
    title: "Support humain",
    desc: "Une équipe à votre écoute pour vous accompagner à chaque étape de la garde.",
    iconClass: "text-[var(--dogshift-blue)]",
    iconBg: "bg-[var(--dogshift-blue)]/10 ring-[var(--dogshift-blue)]/20",
  },
] as const;

function ReassuranceSection() {
  const stagger = useStaggerReveal(4, { step: 80, repeat: true });

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Pourquoi nous faire confiance
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Une plateforme construite avec exigence
          </h2>
          <div
            ref={stagger.ref as React.RefObject<HTMLDivElement>}
            className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {REASSURANCE_ITEMS.map(({ icon: Icon, title, desc, iconClass, iconBg }, i) => (
              <div
                key={title}
                style={stagger.itemStyle(i)}
                className="group rounded-3xl border border-slate-200 bg-white p-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300/80 hover:bg-slate-50/50 hover:shadow-[0_8px_30px_rgba(2,6,23,0.06)]"
              >
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${iconClass}`} aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SERVICES SECTION ──────────────────────────────────────────────────────────

const SERVICES_DETAIL = [
  {
    icon: MapPin,
    label: "Promenade",
    desc: "Sorties individuelles adaptées au rythme et à la personnalité de votre chien, assurées par un dogsitter sélectionné.",
    benefit: "Idéal pour les journées chargées",
    detail: "30 min à 2 heures",
    href: "/search?service=Promenade",
    iconClass: "text-sky-600",
    iconBg: "bg-sky-50 ring-sky-200/80",
  },
  {
    icon: Shield,
    label: "Dogsitting",
    desc: "Garde à domicile chez le dogsitter, dans un environnement familier et rassurant pour votre chien.",
    benefit: "Une journée complète en toute sécurité",
    detail: "De quelques heures à la journée",
    href: "/search?service=Garde",
    iconClass: "text-violet-600",
    iconBg: "bg-violet-50 ring-violet-200/80",
  },
  {
    icon: Umbrella,
    label: "Pension",
    desc: "Hébergement complet chez le dogsitter pour vos voyages ou absences prolongées. Votre chien vit comme à la maison.",
    benefit: "Des vacances sereines pour vous deux",
    detail: "Nuit ou semaine",
    href: "/search?service=Pension",
    iconClass: "text-amber-600",
    iconBg: "bg-amber-50 ring-amber-200/80",
  },
] as const;

function ServicesSection() {
  const reveal = useRevealOnce({ repeat: true });
  const stagger = useStaggerReveal(3, { step: 120, repeat: true });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div ref={reveal.ref} style={reveal.style} className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Nos services
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Un service adapté à chaque besoin
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Que vous ayez besoin d'une sortie ponctuelle ou d'un hébergement complet, DogShift
            propose le service qui correspond à votre situation.
          </p>
        </div>

        <div
          ref={stagger.ref as React.RefObject<HTMLDivElement>}
          className="mt-8 grid gap-5 sm:grid-cols-3 lg:gap-6"
        >
          {SERVICES_DETAIL.map(({ icon: Icon, label, desc, benefit, detail, href, iconClass, iconBg }, i) => (
            <div
              key={label}
              style={stagger.itemStyle(i)}
              className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.14)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-42px_rgba(2,6,23,0.21)]"
            >
              <span
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${iconBg}`}
              >
                <Icon className={`h-6 w-6 ${iconClass}`} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{label}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{desc}</p>
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium text-slate-500">{detail}</p>
                <p className="text-xs font-semibold text-emerald-700">{benefit}</p>
              </div>
              <Link
                href={href}
                className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--dogshift-blue)] transition-colors duration-200 hover:text-[var(--dogshift-blue-hover)]"
              >
                Trouver un dogsitter
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── HOW IT WORKS ──────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    step: 1,
    icon: Search,
    title: "Cherchez",
    desc: "Indiquez votre ville, sélectionnez votre service et choisissez vos dates pour voir les profils disponibles.",
  },
  {
    step: 2,
    icon: BadgeCheck,
    title: "Choisissez",
    desc: "Consultez les profils vérifiés, lisez les avis et échangez directement avec le dogsitter.",
  },
  {
    step: 3,
    icon: Wallet,
    title: "Réservez",
    desc: "Confirmez votre demande et réglez en ligne en toute sécurité via notre système de paiement intégré.",
  },
  {
    step: 4,
    icon: Handshake,
    title: "Confiez sereinement",
    desc: "Votre chien est entre de bonnes mains. Suivez la prestation et laissez un avis après la garde.",
  },
] as const;

function HowItWorksSection() {
  const headerReveal = useRevealOnce({ repeat: true });
  const stepsReveal = useStaggerReveal(4, { step: 130, repeat: true });

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div ref={headerReveal.ref} style={headerReveal.style} className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
              Comment ça marche
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Simple, sécurisé, serein
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              De la recherche à la garde, tout se passe sur DogShift — en quelques clics.
            </p>
          </div>

          <div className="relative mt-12">
            {/* Connecting SVG — desktop: full continuous curve behind the icons */}
            <svg
              className="pointer-events-none absolute left-1/2 top-4 z-0 hidden w-[88%] -translate-x-1/2 sm:block"
              viewBox="0 0 1000 80"
              fill="none"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <path
                d="M0 40 C 62 14, 125 14, 188 40 S 312 66, 375 40 S 500 14, 562 40 S 688 66, 750 40 S 875 14, 1000 40"
                stroke="rgba(148,163,184,0.75)"
                strokeWidth="1.5"
                strokeDasharray="5 7"
                strokeLinecap="round"
              />
            </svg>

            <div
              ref={stepsReveal.ref as React.RefObject<HTMLDivElement>}
              className="grid gap-8 sm:grid-cols-4 sm:gap-4"
            >
              {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, i) => (
                <div key={title} style={stepsReveal.itemStyle(i)} className="group text-center">
                  {/* The solid bg-white completely blocks the dashed line without needing complex SVG masks */}
                  <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white">
                    <span className="absolute inset-0 rounded-full bg-[var(--dogshift-blue-pin)] ring-1 ring-[var(--dogshift-blue-pin-solid)] transition-transform duration-300 group-hover:scale-110" />
                    <Icon
                      className="relative h-7 w-7 text-[var(--dogshift-blue)] transition-transform duration-300 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--dogshift-blue)] text-[10px] font-bold text-white shadow-sm">
                      {step}
                    </span>
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-center">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition-all duration-200 hover:bg-[var(--dogshift-blue-hover)] hover:shadow-[0_14px_40px_-26px_rgba(2,6,23,0.35)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              Commencer maintenant
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SECURITY SECTION ──────────────────────────────────────────────────────────

function SecuritySection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div ref={blockReveal.ref} style={blockReveal.style} className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Sécurité & confiance
          </p>
          <h2 className="mt-2 flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            <Lock className="h-6 w-6 shrink-0 text-slate-700" aria-hidden="true" />
            Une plateforme sécurisée dès le premier jour
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            DogShift est en phase pilote, avec un nombre{" "}
            <span className="font-semibold text-slate-800">volontairement limité</span> de dogsitters
            admis après un processus de{" "}
            <span className="font-semibold text-slate-800">sélection exigeant</span>. Cette approche
            nous permet de construire une plateforme fiable, responsable et orientée confiance, dès
            les premières réservations.
          </p>

          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, text: "DogShift agit comme plateforme de mise en relation sécurisée, avec paiement et support intégrés." },
              { icon: Umbrella, text: "Les dogsitters doivent disposer d'une assurance responsabilité civile valable, couvrant la garde d'animaux." },
              { icon: ShieldCheck, text: "DogShift est assuré en tant que plateforme, afin de garantir un cadre fiable et professionnel." },
              { icon: FileText, text: "Chaque réservation bénéficie d'un cadre contractuel clair entre le propriétaire et le dogsitter." },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="pt-1.5 text-sm leading-relaxed text-slate-700 sm:text-base">{text}</p>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm font-medium text-slate-500 sm:text-base">
            DogShift se construit avec exigence, transparence et responsabilité — pour une expérience
            de garde sereine et durable.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── MAP SECTION ───────────────────────────────────────────────────────────────

function MapSection() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Couverture
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
            Trouvez des dogsitters autour de vous
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
            Explorez la carte pour voir les dogsitters disponibles près de chez vous.
          </p>
        </div>
        <MapPreview embedded previewHeightClass="h-[260px] w-full sm:h-[340px]" />
      </div>
    </section>
  );
}

// ── BECOME A SITTER ───────────────────────────────────────────────────────────

function BenefitCard({ label, icon }: { label: string; icon: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <li
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-row items-center justify-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-left text-blue-100 sm:flex-col sm:items-center sm:justify-start sm:gap-0 sm:px-4 sm:pt-6 sm:pb-5 cursor-default"
      style={{
        transition: "transform 300ms cubic-bezier(0.34,1.56,0.64,1), background-color 300ms ease, border-color 300ms ease, box-shadow 300ms ease",
        transform: hovered ? "translateY(-4px)" : "translateY(0px)",
        backgroundColor: hovered ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
        borderColor: hovered ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
        boxShadow: hovered ? "0 12px 40px -10px rgba(0,0,0,0.40)" : "none",
      }}
    >
      {/* Mobile only: checkmark left of text */}
      <CheckCircle2
        className="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-400 sm:hidden"
        aria-hidden="true"
      />
      {/* Desktop: icon in fixed-height zone so all icons stay at same Y */}
      <div className="hidden sm:flex h-10 w-10 items-center justify-center">
        <img
          src={icon}
          alt=""
          aria-hidden="true"
          style={{
            width: "36px",
            height: "36px",
            transition: "transform 300ms cubic-bezier(0.34,1.56,0.64,1)",
            transform: hovered ? "scale(1.18)" : "scale(1)",
          }}
        />
      </div>
      <span className="text-[13px] font-medium leading-snug sm:mt-3 sm:text-sm sm:text-center">{label}</span>
    </li>
  );
}

function BecomeSitterSection() {
  const reveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-[var(--dogshift-blue)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div ref={reveal.ref} style={reveal.style} className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-200">
            Rejoignez DogShift
          </p>
          <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Devenez dogsitter et partagez votre passion
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-blue-100/90 sm:text-lg">
            Rejoignez une plateforme premium construite avec exigence. Créez votre profil, fixez vos
            tarifs et accueillez des chiens près de chez vous.
          </p>

          <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-3 sm:gap-4">
            {[
              { label: "Profil gratuit, activation rapide", icon: "/caret-forward-circle-outline.svg" },
              { label: "Fixez vos propres tarifs et horaires", icon: "/compose.svg" },
              { label: "Support et accompagnement DogShift", icon: "/badge-help.svg" },
            ].map(({ label, icon }) => (
              <BenefitCard key={label} label={label} icon={icon} />
            ))}
          </ul>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/devenir-dogsitter"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--dogshift-blue)] shadow-lg shadow-[rgba(2,6,23,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Candidater maintenant
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/become-sitter/access"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-medium text-white/85 transition-all duration-200 hover:border-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Déjà dogsitter ? Accès sitter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── WHY DOGSHIFT ──────────────────────────────────────────────────────────────

function WhyDogShiftSection() {
  const whyHeaderReveal = useRevealOnce({ repeat: true });
  const cardsReveal = useStaggerReveal(4, { step: 80, repeat: true });
  const forYouReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="grid gap-16 sm:gap-20">
          {/* Why cards */}
          <div>
            <div ref={whyHeaderReveal.ref} style={whyHeaderReveal.style}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
                Notre différence
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Pourquoi choisir DogShift ?
              </h2>
            </div>

            <div
              ref={cardsReveal.ref as React.RefObject<HTMLDivElement>}
              className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {[
                { icon: BadgeCheck, title: "Sélection rigoureuse", desc: "Un nombre volontairement limité de dogsitters, sélectionnés avec soin en phase pilote." },
                { icon: UserCheck, title: "Profils vérifiés", desc: "Informations vérifiées et profils détaillés pour choisir en toute confiance." },
                { icon: Wallet, title: "Paiement sécurisé", desc: "Paiement sécurisé et cadre contractuel clair dès la première réservation." },
                { icon: MapPin, title: "Plateforme suisse", desc: "Plateforme suisse, locale et responsable, centrée sur la relation humaine." },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={title}
                  style={cardsReveal.itemStyle(i)}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.14)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-42px_rgba(2,6,23,0.20)]"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* For you checklist */}
          <div ref={forYouReveal.ref} style={forYouReveal.style}>
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-[0_18px_60px_-50px_rgba(2,6,23,0.12)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
                C'est fait pour vous
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                DogShift est fait pour vous si…
              </h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Vous cherchez un dogsitter de confiance, pas simplement disponible",
                  "Vous privilégiez une relation locale, humaine et transparente",
                  "Vous voulez une plateforme sécurisée, claire et responsable",
                  "Vous souhaitez éviter les profils flous et les mauvaises surprises",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                    <p className="text-sm leading-relaxed text-slate-700 sm:text-base">{item}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FAQ SECTION ───────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "DogShift est-il une pension pour chiens\u00A0?",
    a: "Non. DogShift est une plateforme de mise en relation entre propriétaires et dogsitters indépendants, pour une garde personnalisée et adaptée à chaque chien.",
  },
  {
    q: "Comment sont sélectionnés les dogsitters\u00A0?",
    a: "Chaque dogsitter passe par un processus de sélection et doit fournir des informations claires — dont la vérification du casier judiciaire — avant d'être accepté sur la plateforme.",
  },
  {
    q: "Que se passe-t-il en cas de problème\u00A0?",
    a: "DogShift agit comme intermédiaire sécurisé, avec un cadre contractuel et un support intégré pour accompagner les utilisateurs en cas de difficulté.",
  },
  {
    q: "DogShift est-il disponible dans ma ville\u00A0?",
    a: "DogShift se développe progressivement en Suisse romande — Lausanne, Genève, Montreux, Vevey, Nyon et Morges. D'autres villes seront ajoutées prochainement.",
  },
] as const;

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const reveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div ref={reveal.ref} style={reveal.style} className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Questions fréquentes
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Vous avez des questions ?
          </h2>

          <div className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-50px_rgba(2,6,23,0.10)]">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--dogshift-blue)]"
                  aria-expanded={openIndex === i}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={
                      "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200" +
                      (openIndex === i ? " rotate-180" : "")
                    }
                    aria-hidden="true"
                  />
                </button>
                {openIndex === i ? (
                  <div className="px-6 pb-5">
                    <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{item.a}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Vous ne trouvez pas la réponse ?{" "}
            <Link
              href="/help"
              className="font-semibold text-[var(--dogshift-blue)] underline-offset-4 hover:underline"
            >
              Contactez-nous
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── CITIES SEO ────────────────────────────────────────────────────────────────

const CITIES = [
  { label: "Dog sitter Lausanne", href: "/dog-sitter-lausanne" },
  { label: "Dog sitter Montreux", href: "/dog-sitter-montreux" },
  { label: "Dog sitter Vevey", href: "/dog-sitter-vevey" },
  { label: "Dog sitter Nyon", href: "/dog-sitter-nyon" },
  { label: "Dog sitter Morges", href: "/dog-sitter-morges" },
  { label: "Dog sitter Genève", href: "/dog-sitter-geneve" },
] as const;

function CitiesSection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div ref={blockReveal.ref} style={blockReveal.style} className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Couverture géographique
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Trouver un dogsitter près de chez vous
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            DogShift se développe progressivement en Suisse romande. Découvrez nos services
            disponibles près de chez vous.
          </p>

          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
            {CITIES.map((city) => (
              <li key={city.href}>
                <Link
                  href={city.href}
                  className="block py-2 text-sm font-medium text-slate-600 underline-offset-4 transition-colors duration-150 hover:text-[var(--dogshift-blue)] hover:underline"
                >
                  {city.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── COMMUNITY SECTION ─────────────────────────────────────────────────────────

function CommunitySection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div id="contribution" className="mx-auto max-w-5xl">
          <div ref={blockReveal.ref} style={blockReveal.style} className="flex flex-col gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
                Communauté
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Soutenir le lancement de DogShift
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                DogShift est en phase pilote, construite de manière indépendante et responsable.
                Certaines personnes souhaitent contribuer volontairement au lancement de la
                plateforme.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Ce soutien permet d&apos;accompagner le développement, l&apos;infrastructure et les
                outils nécessaires à une expérience fiable dès le lancement officiel.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-base">
                Toute contribution est facultative et n&apos;influence en aucun cas l&apos;accès ou
                l&apos;utilisation de la plateforme.
              </p>
            </div>

            <div className="mt-2">
              <Link
                href="/contribuer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)] sm:w-auto"
              >
                Contribuer au lancement
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── CAREERS SECTION ───────────────────────────────────────────────────────────

function CareersSection() {
  const headerReveal = useRevealOnce({ repeat: true });
  const blocksReveal = useStaggerReveal(3, { step: 140, repeat: true });

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <div ref={headerReveal.ref} style={headerReveal.style} className="text-center">
            <p className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-medium text-slate-600 shadow-sm">
              Carrières
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Travailler chez DogShift
            </h2>
          </div>

          <div
            ref={blocksReveal.ref as React.RefObject<HTMLDivElement>}
            className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-12"
          >
            {[
              { icon: Briefcase, title: "Construire avec exigence", desc: "DogShift se construit progressivement, avec exigence et passion." },
              { icon: UserCheck, title: "Travailler avec des valeurs", desc: "Nous collaborons avec des profils partageant nos valeurs de confiance, responsabilité et qualité de service." },
              { icon: Handshake, title: "Échanger simplement", desc: "Si vous souhaitez contribuer au développement d'une plateforme suisse et humaine, nous serions ravis d'échanger." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={title} style={blocksReveal.itemStyle(i)} className="group text-center">
                <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center transition-transform duration-[250ms] ease-out group-hover:-translate-y-0.5">
                  <Icon className="h-12 w-12 text-[var(--dogshift-blue)]" aria-hidden="true" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-semibold">
            <Link
              href="/help"
              className="text-[var(--dogshift-blue)] transition-all duration-[250ms] ease-out hover:-translate-y-px hover:text-[var(--dogshift-blue-hover)]"
            >
              Nous contacter
            </Link>
            <span className="text-slate-300" aria-hidden="true">
              /
            </span>
            <Link
              href="/help"
              className="text-[var(--dogshift-blue)] transition-all duration-[250ms] ease-out hover:-translate-y-px hover:text-[var(--dogshift-blue-hover)]"
            >
              Découvrir les opportunités
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FINAL CTA ─────────────────────────────────────────────────────────────────

function FinalCTASection() {
  const blockReveal = useRevealOnce({ repeat: true });

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <div ref={blockReveal.ref} style={blockReveal.style} className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--dogshift-blue)]">
            Prochaine étape
          </p>
          <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Prêt à trouver un dogsitter de confiance ?
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            Découvrez des profils locaux, sélectionnés avec soin, et réservez en toute sérénité.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/search"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition-all duration-200 hover:bg-[var(--dogshift-blue-hover)] hover:shadow-[0_14px_40px_-26px_rgba(2,6,23,0.35)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              Trouver un dogsitter
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/devenir-dogsitter"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:shadow-md active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
            >
              Devenir dogsitter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── ROOT COMPONENT ────────────────────────────────────────────────────────────

export default function HomePageClient({ sitters = [] }: { sitters?: SitterPreview[] }) {
  const mapReveal = useRevealOnce({ repeat: true });
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 150);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <StickySearchBar visible={showSticky} />
      <main className="pb-24 md:pb-0">
        <HeroSection />
        {sitters.length > 0 && <FeaturedSittersSection sitters={sitters} />}
        <ReassuranceSection />
        <ServicesSection />
        <HowItWorksSection />
        <SecuritySection />

        <div ref={mapReveal.ref} style={mapReveal.style}>
          <MapSection />
        </div>

        <BecomeSitterSection />
        <WhyDogShiftSection />
        <FAQSection />
        <CitiesSection />
        <CommunitySection />
        <CareersSection />
        <FinalCTASection />
      </main>
    </div>
  );
}
