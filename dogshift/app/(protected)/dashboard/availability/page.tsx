"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useHostUser } from "@/components/HostUserProvider";
import { normalizeRanges } from "@/lib/availability/rangeValidation";

type ServiceTypeApi = "PROMENADE" | "DOGSITTING" | "PENSION";

type ServiceConfig = {
  enabled: boolean;
};

type RuleRow = {
  id: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  status: "AVAILABLE" | "ON_REQUEST";
};

type ExceptionRow = {
  id: string;
  date: string; // yyyy-mm-dd
  startMin: number;
  endMin: number;
  status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
};

type ToastState = { tone: "ok" | "error"; message: string } | null;

function minutesToHHMM(min: number) {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function hhmmToMinutes(value: string) {
  const v = (value ?? "").trim();
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const out = hh * 60 + mm;
  if (out < 0 || out > 24 * 60) return null;
  return out;
}

function serviceMeta(svc: ServiceTypeApi) {
  if (svc === "PROMENADE") return { icon: "🚶", label: "Promenade" };
  if (svc === "DOGSITTING") return { icon: "🏠", label: "Dogsitting" };
  return { icon: "🛌", label: "Pension" };
}

function startOfMonthIso(dt: Date) {
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 12, 0, 0, 0));
}

function toZurichIsoDate(dt: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function monthMeta(cursor: Date) {
  const y = cursor.getUTCFullYear();
  const m = cursor.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1, 12, 0, 0, 0));
  const last = new Date(Date.UTC(y, m + 1, 0, 12, 0, 0, 0));
  const fromIso = toZurichIsoDate(first);
  const toIso = toZurichIsoDate(last);
  const firstLocalDow = new Date(`${fromIso}T12:00:00Z`).getUTCDay();
  const mondayIndex = (firstLocalDow + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", month: "long", year: "numeric" }).format(first);
  const daysInMonth = Number(toIso.slice(8, 10));
  return { fromIso, toIso, mondayIndex, daysInMonth, monthLabel, year: y, month: m };
}

export default function AvailabilityStudioPage() {
  const host = useHostUser();
  const sitterId = host.sitterId;

  const [service, setService] = useState<ServiceTypeApi>("PROMENADE");

  const [configByService, setConfigByService] = useState<Record<ServiceTypeApi, ServiceConfig | null>>({
    PROMENADE: null,
    DOGSITTING: null,
    PENSION: null,
  });

  const [rulesByService, setRulesByService] = useState<Record<ServiceTypeApi, RuleRow[]>>({
    PROMENADE: [],
    DOGSITTING: [],
    PENSION: [],
  });

  const [exceptionsByService, setExceptionsByService] = useState<Record<ServiceTypeApi, ExceptionRow[]>>({
    PROMENADE: [],
    DOGSITTING: [],
    PENSION: [],
  });

  const [monthCursor, setMonthCursor] = useState(() => startOfMonthIso(new Date()));
  const meta = useMemo(() => monthMeta(monthCursor), [monthCursor]);

  const [monthDays, setMonthDays] = useState<
    Array<{ date: string; promenadeStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; dogsittingStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE"; pensionStatus: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE" }>
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPing, setSavedPing] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [bookingInfoOpen, setBookingInfoOpen] = useState(false);

  const [exceptionDrawerOpen, setExceptionDrawerOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState<string>("");
  const [exceptionStatus, setExceptionStatus] = useState<"AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE">("UNAVAILABLE");
  const [exceptionAllDay, setExceptionAllDay] = useState(true);
  const [exceptionRanges, setExceptionRanges] = useState<Array<{ startMin: number; endMin: number }>>([]);
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  const exceptionDrawerTitleRef = useRef<HTMLParagraphElement | null>(null);
  const exceptionDrawerRef = useRef<HTMLDivElement | null>(null);
  const exceptionDrawerRestoreFocusRef = useRef<HTMLElement | null>(null);
  const exceptionDrawerInitialSnapshotRef = useRef<string>("");

  const monthStatusByDate = useMemo(() => {
    const map = new Map<string, (typeof monthDays)[number]>();
    for (const row of monthDays) map.set(row.date, row);
    return map;
  }, [monthDays]);

  const refreshTokenRef = useRef(0);

  async function saveServiceEnabled(svc: ServiceTypeApi, enabled: boolean) {
    if (!sitterId) return;
    setLoading(true);
    setError(null);
    try {
      setConfigByService((prev) => {
        const next = { ...prev };
        const cur = prev[svc];
        (next as any)[svc] = cur ? { ...cur, enabled } : ({ enabled } as any);
        return next;
      });

      const res = await fetch(`/api/sitters/me/service-config?service=${encodeURIComponent(svc)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "SAVE_ERROR");

      showToast({ tone: "ok", message: enabled ? "Service activé" : "Service désactivé" });
      await refetchAll();
    } catch (e) {
      showToast({ tone: "error", message: "Impossible d’enregistrer" });
      await refetchAll();
      setError(e instanceof Error ? e.message : "SAVE_ERROR");
    } finally {
      setLoading(false);
    }
  }

  async function refetchAll() {
    if (!sitterId) return;
    const token = ++refreshTokenRef.current;
    setLoading(true);
    setError(null);

    try {
      const services: ServiceTypeApi[] = ["PROMENADE", "DOGSITTING", "PENSION"];

      const cfgPairs = await Promise.all(
        services.map(async (svc) => {
          const res = await fetch(`/api/sitters/me/service-config?service=${encodeURIComponent(svc)}`, { method: "GET", cache: "no-store" });
          const payload = (await res.json().catch(() => null)) as any;
          if (!res.ok || !payload?.ok || typeof payload?.enabled !== "boolean") throw new Error("CONFIG_ERROR");
          return [svc, { enabled: payload.enabled } satisfies ServiceConfig] as const;
        })
      );
      if (token !== refreshTokenRef.current) return;
      setConfigByService((prev) => {
        const next = { ...prev };
        for (const [svc, cfg] of cfgPairs) (next as any)[svc] = cfg;
        return next;
      });

      const rulesPairs = await Promise.all(
        services.map(async (svc) => {
          const res = await fetch(`/api/sitters/me/availability-rules?service=${encodeURIComponent(svc)}`, { method: "GET", cache: "no-store" });
          const payload = (await res.json().catch(() => null)) as any;
          if (!res.ok || !payload?.ok || !Array.isArray(payload?.rules)) throw new Error("RULES_ERROR");
          return [svc, payload.rules as RuleRow[]] as const;
        })
      );
      if (token !== refreshTokenRef.current) return;
      setRulesByService((prev) => {
        const next = { ...prev };
        for (const [svc, rules] of rulesPairs) (next as any)[svc] = rules;
        return next;
      });

      const excPairs = await Promise.all(
        services.map(async (svc) => {
          const res = await fetch(
            `/api/sitters/me/availability-exceptions?service=${encodeURIComponent(svc)}&from=${encodeURIComponent(meta.fromIso)}&to=${encodeURIComponent(meta.toIso)}`,
            { method: "GET", cache: "no-store" }
          );
          const payload = (await res.json().catch(() => null)) as any;
          if (!res.ok || !payload?.ok || !Array.isArray(payload?.exceptions)) throw new Error("EXC_ERROR");
          return [svc, payload.exceptions as ExceptionRow[]] as const;
        })
      );
      if (token !== refreshTokenRef.current) return;
      setExceptionsByService((prev) => {
        const next = { ...prev };
        for (const [svc, exceptions] of excPairs) (next as any)[svc] = exceptions;
        return next;
      });

      // Public preview month calendar (truth = slotEngine summaries)
      const qp = new URLSearchParams();
      qp.set("from", meta.fromIso);
      qp.set("to", meta.toIso);
      qp.set("service", service);
      const res = await fetch(`/api/sitters/${encodeURIComponent(sitterId)}/day-status/multi?${qp.toString()}`, { method: "GET", cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || !Array.isArray(payload?.days)) throw new Error("DAY_STATUS_ERROR");
      if (token !== refreshTokenRef.current) return;
      setMonthDays(payload.days);

      setSavedPing("Synchronisé avec l’agenda public");
      setTimeout(() => setSavedPing(null), 1800);
    } catch (e) {
      if (token !== refreshTokenRef.current) return;
      setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      if (token !== refreshTokenRef.current) return;
      setLoading(false);
    }

    return;
  }

  function showToast(next: ToastState) {
    setToast(next);
    if (!next) return;
    setTimeout(() => setToast(null), 2200);
  }

  const exceptionDatesForService = useMemo(() => {
    const set = new Set<string>();
    for (const e of exceptionsByService[service] ?? []) {
      if (e && typeof e.date === "string") set.add(e.date);
    }
    return set;
  }, [exceptionsByService, service]);

  const exceptionsForSelectedDate = useMemo(() => {
    if (!exceptionDate) return [] as ExceptionRow[];
    return (exceptionsByService[service] ?? []).filter((e) => e.date === exceptionDate);
  }, [exceptionDate, exceptionsByService, service]);

  const exceptionRangesValidation = useMemo(() => {
    if (exceptionAllDay) return { ok: true as const, error: null as string | null };
    if (!exceptionRanges.length) return { ok: false as const, error: "Ajoute au moins une plage." };
    for (const r of exceptionRanges) {
      if (r.endMin <= r.startMin) return { ok: false as const, error: "Une plage a une fin avant son début." };
    }
    const normalized = normalizeRanges(exceptionRanges);
    if (!normalized.ok) return { ok: false as const, error: "Les plages se chevauchent." };
    return { ok: true as const, error: null as string | null };
  }, [exceptionAllDay, exceptionRanges]);

  const exceptionHasUnsavedChanges = useMemo(() => {
    if (!exceptionDrawerOpen) return false;
    const snap = JSON.stringify({
      date: exceptionDate,
      status: exceptionStatus,
      allDay: exceptionAllDay,
      ranges: exceptionRanges,
    });
    return snap !== exceptionDrawerInitialSnapshotRef.current;
  }, [exceptionAllDay, exceptionDate, exceptionDrawerOpen, exceptionRanges, exceptionStatus]);

  function closeExceptionDrawer() {
    if (exceptionSaving) return;
    if (exceptionHasUnsavedChanges) {
      const ok = window.confirm("Quitter sans enregistrer ?");
      if (!ok) return;
    }
    setExceptionDrawerOpen(false);
  }

  function openExceptionDrawer(dateIso: string) {
    exceptionDrawerRestoreFocusRef.current = document.activeElement as HTMLElement | null;
    setExceptionDate(dateIso);
    setExceptionError(null);

    const existing = (exceptionsByService[service] ?? []).filter((e) => e.date === dateIso);
    if (existing.length) {
      // 1 exception per date/service: derive the form from the existing set.
      const st = existing[0].status;
      setExceptionStatus(st);
      const isAllDay = existing.length === 1 && existing[0].startMin === 0 && existing[0].endMin === 24 * 60;
      setExceptionAllDay(isAllDay);
      setExceptionRanges(
        isAllDay
          ? []
          : existing.map((r) => ({ startMin: r.startMin, endMin: r.endMin })).sort((a, b) => a.startMin - b.startMin)
      );
    } else {
      setExceptionStatus("UNAVAILABLE");
      setExceptionAllDay(true);
      setExceptionRanges([]);
    }

    exceptionDrawerInitialSnapshotRef.current = JSON.stringify({
      date: dateIso,
      status: existing.length ? existing[0].status : "UNAVAILABLE",
      allDay: existing.length ? (existing.length === 1 && existing[0].startMin === 0 && existing[0].endMin === 24 * 60) : true,
      ranges:
        existing.length && !(existing.length === 1 && existing[0].startMin === 0 && existing[0].endMin === 24 * 60)
          ? existing.map((r) => ({ startMin: r.startMin, endMin: r.endMin })).sort((a, b) => a.startMin - b.startMin)
          : [],
    });
    setExceptionDrawerOpen(true);
  }

  useEffect(() => {
    if (!exceptionDrawerOpen) {
      const el = exceptionDrawerRestoreFocusRef.current;
      if (el && typeof el.focus === "function") {
        try {
          el.focus();
        } catch {
          // ignore
        }
      }
      return;
    }

    const t = setTimeout(() => {
      const node = exceptionDrawerTitleRef.current;
      if (node && typeof (node as any).focus === "function") {
        (node as any).focus();
      }
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeExceptionDrawer();
        return;
      }

      if (e.key !== "Tab") return;
      const root = exceptionDrawerRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [exceptionDrawerOpen, exceptionHasUnsavedChanges, exceptionSaving]);

  useEffect(() => {
    void refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitterId, meta.fromIso, meta.toIso]);

  const selectedConfig = configByService[service];
  const selectedRules = rulesByService[service];

  const rulesByDow = useMemo(() => {
    const map = new Map<number, RuleRow[]>();
    for (const r of selectedRules) {
      map.set(r.dayOfWeek, [...(map.get(r.dayOfWeek) ?? []), r]);
    }
    for (const [k, v] of map) v.sort((a, b) => a.startMin - b.startMin);
    return map;
  }, [selectedRules]);

  function statusTone(status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") {
    return status === "AVAILABLE" ? "bg-emerald-500" : status === "ON_REQUEST" ? "bg-amber-500" : "bg-slate-300";
  }

  const focusDayTone = (row: (typeof monthDays)[number] | null) => {
    const cellTone = !row
      ? "UNAVAILABLE"
      : service === "PROMENADE"
        ? row.promenadeStatus
        : service === "DOGSITTING"
          ? row.dogsittingStatus
          : row.pensionStatus;
    return cellTone === "AVAILABLE"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : cellTone === "ON_REQUEST"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-slate-100 text-slate-500 ring-slate-200";
  };

  async function saveDayRules(dayOfWeek: number, next: Array<{ startMin: number; endMin: number; status: "AVAILABLE" | "ON_REQUEST" }>) {
    if (!sitterId) return;
    const rangesOnly = next.map((r) => ({ startMin: r.startMin, endMin: r.endMin }));
    const normalized = normalizeRanges(rangesOnly);
    if (!normalized.ok) {
      setError("INVALID_RANGES");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sitters/me/availability-rules?service=${encodeURIComponent(service)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek, rules: next }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "SAVE_ERROR");
      await refetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "SAVE_ERROR");
    } finally {
      setLoading(false);
    }
  }

  const weekLabels = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  if (!sitterId) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8">
        <p className="text-sm font-semibold text-slate-900">Disponibilités</p>
        <p className="mt-2 text-sm text-slate-600">Crée ton profil sitter pour configurer ton agenda.</p>
        <div className="mt-4">
          <Link href="/become-sitter" className="text-sm font-semibold text-[var(--dogshift-blue)]">
            Devenir sitter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900">Disponibilités</p>
          <p className="mt-2 text-sm text-slate-600">Configure tes services, tes règles hebdo et tes exceptions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/sitter/${encodeURIComponent(sitterId)}?mode=public`}
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
          >
            Ouvrir ma page publique
          </Link>
          {savedPing ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
              🟢 {savedPing}
            </span>
          ) : null}

      {exceptionDrawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exception-drawer-title"
          aria-describedby="exception-drawer-desc"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeExceptionDrawer();
          }}
        >
          <div ref={exceptionDrawerRef} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p
                  id="exception-drawer-title"
                  ref={exceptionDrawerTitleRef}
                  tabIndex={-1}
                  className="text-sm font-semibold text-slate-900"
                >
                  {exceptionsForSelectedDate.length ? "Exception" : "Ajouter une exception"}
                </p>
                <p className="mt-1 text-sm text-slate-600">{exceptionDate}</p>
              </div>
              <button
                type="button"
                onClick={() => closeExceptionDrawer()}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
              >
                Fermer
              </button>
            </div>

            <p id="exception-drawer-desc" className="mt-3 text-xs font-semibold text-slate-500">
              Les exceptions remplacent les règles hebdomadaires pour cette date.
            </p>

            {exceptionsForSelectedDate.length ? (
              <div className="mt-4 grid gap-2">
                {exceptionsForSelectedDate.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">{e.status}</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {minutesToHHMM(e.startMin)}–{minutesToHHMM(e.endMin)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {e.startMin === 0 && e.endMin === 24 * 60 ? "Toute la journée" : `${minutesToHHMM(e.startMin)}–${minutesToHHMM(e.endMin)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setExceptionSaving(true);
                        setExceptionError(null);
                        try {
                          const res = await fetch("/api/sitters/me/availability-exceptions", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: e.id }),
                          });
                          const payload = (await res.json().catch(() => null)) as any;
                          if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "DELETE_ERROR");
                          showToast({ tone: "ok", message: "Exception supprimée" });
                          await refetchAll();
                        } catch (err) {
                          setExceptionError(err instanceof Error ? err.message : "DELETE_ERROR");
                          showToast({ tone: "error", message: "Impossible de supprimer" });
                        } finally {
                          setExceptionSaving(false);
                        }
                      }}
                      disabled={exceptionSaving}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-60"
                      aria-label="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">{exceptionsForSelectedDate.length ? "Modifier" : "Créer"}</p>

              <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                <p>AVAILABLE : Tu acceptes automatiquement</p>
                <p className="mt-1">ON_REQUEST : Tu dois confirmer</p>
                <p className="mt-1">UNAVAILABLE : Non réservable</p>
              </div>

              <div className="mt-3 grid gap-3">
                <label className="text-xs font-semibold text-slate-700">
                  Statut
                  <select
                    value={exceptionStatus}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "AVAILABLE" || v === "ON_REQUEST" || v === "UNAVAILABLE") setExceptionStatus(v);
                    }}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    aria-label="Statut exception"
                  >
                    <option value="AVAILABLE">Disponible</option>
                    <option value="ON_REQUEST">Sur demande</option>
                    <option value="UNAVAILABLE">Indisponible</option>
                  </select>
                </label>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Toute la journée</p>
                    <p className="mt-1 text-xs text-slate-600">Sinon, définis des plages horaires.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExceptionAllDay((v) => !v)}
                    className={
                      exceptionAllDay
                        ? "rounded-full bg-[var(--dogshift-blue)] px-3 py-1 text-xs font-semibold text-white"
                        : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                    }
                    aria-pressed={exceptionAllDay}
                  >
                    {exceptionAllDay ? "Oui" : "Non"}
                  </button>
                </div>

                {!exceptionAllDay ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Plages horaires</p>
                    <div className="mt-2 grid gap-2">
                      {exceptionRanges.length ? (
                        exceptionRanges.map((r, idx) => (
                          <div key={`exr-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                              type="time"
                              value={minutesToHHMM(r.startMin)}
                              step={900}
                              onChange={(e) => {
                                const nextStart = hhmmToMinutes(e.target.value);
                                if (nextStart === null) return;
                                setExceptionRanges((prev) => {
                                  const next = prev.slice();
                                  next[idx] = { ...next[idx], startMin: nextStart };
                                  return next;
                                });
                              }}
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                              aria-label={`Exception début ${idx + 1}`}
                            />
                              <input
                              type="time"
                              value={minutesToHHMM(r.endMin)}
                              step={900}
                              onChange={(e) => {
                                const nextEnd = hhmmToMinutes(e.target.value);
                                if (nextEnd === null) return;
                                setExceptionRanges((prev) => {
                                  const next = prev.slice();
                                  next[idx] = { ...next[idx], endMin: nextEnd };
                                  return next;
                                });
                              }}
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                              aria-label={`Exception fin ${idx + 1}`}
                            />
                          </div>

                            {r.endMin <= r.startMin ? (
                              <p className="mt-2 text-xs font-semibold text-rose-700">La fin doit être après le début.</p>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExceptionRanges((prev) => {
                                    const next = prev.slice();
                                    next.splice(idx, 1);
                                    return next;
                                  })
                                }
                                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                                aria-label="Supprimer cette plage"
                              >
                                🗑️ Supprimer
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setExceptionRanges((prev) => {
                                    const next = prev.slice();
                                    next.splice(idx + 1, 0, { startMin: r.startMin, endMin: r.endMin });
                                    return next;
                                  })
                                }
                                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                                aria-label="Dupliquer cette plage"
                              >
                                Dupliquer
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-600">Aucune plage.</p>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExceptionRanges((prev) => [...prev, { startMin: 9 * 60, endMin: 12 * 60 }])}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
                        >
                          + Ajouter plage
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!exceptionRangesValidation.ok ? (
                  <p className="text-sm font-semibold text-rose-700">{exceptionRangesValidation.error}</p>
                ) : null}

                {exceptionError ? <p className="text-sm font-semibold text-rose-700">{exceptionError}</p> : null}

                <button
                  type="button"
                  disabled={exceptionSaving || !exceptionRangesValidation.ok}
                  onClick={async () => {
                    setExceptionSaving(true);
                    setExceptionError(null);
                    try {
                      const ranges = exceptionAllDay ? [] : exceptionRanges;
                      const normalized = normalizeRanges(ranges);
                      if (!normalized.ok) {
                        setExceptionError("INVALID_RANGES");
                        showToast({ tone: "error", message: "Plages invalides" });
                        return;
                      }

                      const res = await fetch("/api/sitters/me/availability-exceptions", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          serviceType: service,
                          date: exceptionDate,
                          status: exceptionStatus,
                          ranges: normalized.ranges,
                        }),
                      });
                      const payload = (await res.json().catch(() => null)) as any;
                      if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "SAVE_ERROR");
                      showToast({ tone: "ok", message: "Exception enregistrée" });
                      await refetchAll();
                    } catch (err) {
                      setExceptionError(err instanceof Error ? err.message : "SAVE_ERROR");
                      showToast({ tone: "error", message: "Impossible d’enregistrer" });
                    } finally {
                      setExceptionSaving(false);
                    }
                  }}
                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {exceptionSaving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={
            toast.tone === "ok"
              ? "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
              : "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white"
          }
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-900">{error}</p>
        </div>
      ) : null}

      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setBookingInfoOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"
          aria-haspopup="dialog"
          aria-expanded={bookingInfoOpen}
        >
          ⓘ Fonctionnement des réservations
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Column 1: Services */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Services</p>
          <div className="mt-4 grid gap-3">
            {(["PROMENADE", "DOGSITTING", "PENSION"] as const).map((svc) => {
              const metaSvc = serviceMeta(svc);
              const cfg = configByService[svc];
              const selected = svc === service;
              const enabled = cfg?.enabled !== false;
              return (
                <button
                  key={svc}
                  type="button"
                  onClick={() => setService(svc)}
                  className={
                    selected
                      ? "rounded-3xl border border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_92%)] p-4 text-left"
                      : "rounded-3xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
                  }
                  aria-pressed={selected}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      {metaSvc.icon} {metaSvc.label}
                    </p>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void saveServiceEnabled(svc, !enabled);
                      }}
                      className={
                        enabled
                          ? "relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-500 transition"
                          : "relative inline-flex h-6 w-11 items-center rounded-full bg-slate-300 transition"
                      }
                      aria-label={enabled ? `Désactiver ${metaSvc.label}` : `Activer ${metaSvc.label}`}
                    >
                      <span
                        className={
                          enabled
                            ? "inline-block h-5 w-5 translate-x-5 rounded-full bg-white shadow transition"
                            : "inline-block h-5 w-5 translate-x-1 rounded-full bg-white shadow transition"
                        }
                      />
                    </button>
                  </div>
                  {cfg ? null : <div className="mt-3 h-4 w-40 animate-pulse rounded bg-slate-100" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Weekly rules */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Règles hebdomadaires</p>
          <p className="mt-1 text-sm text-slate-600">Définis tes plages pour {serviceMeta(service).label}.</p>

          <div className="mt-4 grid gap-4">
            {Array.from({ length: 7 }).map((_, dow) => {
              const rows = rulesByDow.get(dow) ?? [];
              const draft = rows.map((r) => ({ startMin: r.startMin, endMin: r.endMin, status: r.status }));
              return (
                <div key={`dow-${dow}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{weekLabels[dow]}</p>
                    <button
                      type="button"
                      onClick={() => saveDayRules(dow, [])}
                      className="text-xs font-semibold text-slate-600 underline underline-offset-2"
                    >
                      Effacer
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {draft.length ? (
                      draft.map((r, idx) => (
                        <div key={`${dow}-${idx}`} className="grid grid-cols-3 gap-2">
                          <input
                            type="time"
                            value={minutesToHHMM(r.startMin)}
                            onChange={(e) => {
                              const nextStart = hhmmToMinutes(e.target.value);
                              if (nextStart === null) return;
                              const next = draft.slice();
                              next[idx] = { ...next[idx], startMin: nextStart };
                              void saveDayRules(dow, next);
                            }}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                            aria-label={`${weekLabels[dow]} début`}
                          />
                          <input
                            type="time"
                            value={minutesToHHMM(r.endMin)}
                            onChange={(e) => {
                              const nextEnd = hhmmToMinutes(e.target.value);
                              if (nextEnd === null) return;
                              const next = draft.slice();
                              next[idx] = { ...next[idx], endMin: nextEnd };
                              void saveDayRules(dow, next);
                            }}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                            aria-label={`${weekLabels[dow]} fin`}
                          />
                          <select
                            value={r.status}
                            onChange={(e) => {
                              const v = e.target.value === "ON_REQUEST" ? "ON_REQUEST" : "AVAILABLE";
                              const next = draft.slice();
                              next[idx] = { ...next[idx], status: v };
                              void saveDayRules(dow, next);
                            }}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                            aria-label={`${weekLabels[dow]} statut`}
                          >
                            <option value="AVAILABLE">Disponible</option>
                            <option value="ON_REQUEST">Sur demande</option>
                          </select>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs font-semibold text-slate-500">Aucune plage.</p>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const baseStart = 9 * 60;
                        const baseEnd = 12 * 60;
                        const next = [...draft, { startMin: baseStart, endMin: baseEnd, status: "AVAILABLE" as const }];
                        void saveDayRules(dow, next);
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
                    >
                      + Ajouter plage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: Exceptions + preview calendar */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Exceptions</p>
              <p className="mt-1 text-sm text-slate-600">Exceptions futures sur le mois courant.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthCursor((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1, 12, 0, 0, 0)))}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                aria-label="Mois précédent"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => setMonthCursor((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12, 0, 0, 0)))}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                aria-label="Mois suivant"
              >
                ▶
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-900">{meta.monthLabel}</p>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-slate-500">
              <div>L</div>
              <div>M</div>
              <div>M</div>
              <div>J</div>
              <div>V</div>
              <div>S</div>
              <div>D</div>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: meta.mondayIndex }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {Array.from({ length: meta.daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateIso = `${String(meta.year).padStart(4, "0")}-${String(meta.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const row = monthStatusByDate.get(dateIso) ?? null;
                const tone = focusDayTone(row);
                return (
                  <button
                    key={dateIso}
                    type="button"
                    onClick={() => openExceptionDrawer(dateIso)}
                    className={`flex h-10 w-full flex-col items-center justify-center rounded-2xl ring-1 ${tone}`}
                    aria-label={`Exception ${dateIso}`}
                  >
                    <span className="text-sm font-semibold leading-none">{day}</span>
                    {row ? (
                      <div className="-mt-1 flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${statusTone(row.promenadeStatus)}`} aria-hidden="true" />
                        <span className={`h-2 w-2 rounded-full ${statusTone(row.dogsittingStatus)}`} aria-hidden="true" />
                        <span className={`h-2 w-2 rounded-full ${statusTone(row.pensionStatus)}`} aria-hidden="true" />
                      </div>
                    ) : null}

                    {exceptionDatesForService.has(dateIso) ? (
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--dogshift-blue)]" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-900">Exceptions ({serviceMeta(service).label})</p>
            <div className="mt-2 grid gap-2">
              {(exceptionsByService[service] ?? []).length ? (
                (exceptionsByService[service] ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">{e.date}</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {minutesToHHMM(e.startMin)}–{minutesToHHMM(e.endMin)} — {e.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await fetch("/api/sitters/me/availability-exceptions", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: e.id }),
                          });
                          await refetchAll();
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                    >
                      Supprimer
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">Aucune exception.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="fixed bottom-6 right-6 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Chargement…</div> : null}

      {bookingInfoOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="Fonctionnement des réservations">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Fonctionnement des réservations</p>
              <button
                type="button"
                onClick={() => setBookingInfoOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
              >
                Fermer
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>Réservation minimum 24h à l’avance.</p>
              <p>15 min bloquées avant + après chaque réservation.</p>
              <p>Créneaux par intervalles (pas = 30 min).</p>
              <p>Pension: check-in 08:00–19:00, check-out 08:00–12:00.</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
