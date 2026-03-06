"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useHostUser } from "@/components/HostUserProvider";
import { normalizeRanges } from "@/lib/availability/rangeValidation";

type ServiceTypeApi = "PROMENADE" | "DOGSITTING" | "PENSION";

type ServiceConfig = {
  enabled: boolean;
};

type ExceptionRow = {
  id: string;
  date: string; // yyyy-mm-dd
  startMin: number;
  endMin: number;
  status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
};

type ToastState = { tone: "ok" | "error"; message: string } | null;

function statusLabelFr(value: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") {
  if (value === "AVAILABLE") return "Disponible";
  if (value === "ON_REQUEST") return "Sur demande";
  return "Indisponible";
}

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

function serviceDotTone(svc: ServiceTypeApi) {
  if (svc === "PROMENADE") return "bg-sky-400";
  if (svc === "DOGSITTING") return "bg-violet-400";
  return "bg-emerald-400";
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

function formatDateFrCh(isoDate: string) {
  const safe = (isoDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe;
  const dt = new Date(`${safe}T12:00:00Z`);
  const out = new Intl.DateTimeFormat("fr-CH", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
  return out.replaceAll(".", "-");
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

  const [availabilityTab, setAvailabilityTab] = useState<ServiceTypeApi>("PROMENADE");

  const todayKeyZurich = useMemo(() => toZurichIsoDate(new Date()), []);

  const [exceptionDrawerOpen, setExceptionDrawerOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState<string>("");
  const [exceptionService, setExceptionService] = useState<ServiceTypeApi>("PROMENADE");
  const [exceptionStatus, setExceptionStatus] = useState<"AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE">("UNAVAILABLE");
  const [exceptionAllDay, setExceptionAllDay] = useState(true);
  const [exceptionRanges, setExceptionRanges] = useState<Array<{ startMin: number; endMin: number }>>([]);
  const [justAddedRangeIdx, setJustAddedRangeIdx] = useState<number | null>(null);
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  const exceptionFormLoadedKeyRef = useRef<string>("");

  const exceptionDrawerTitleRef = useRef<HTMLParagraphElement | null>(null);
  const exceptionDrawerRef = useRef<HTMLDivElement | null>(null);
  const exceptionDrawerRestoreFocusRef = useRef<HTMLElement | null>(null);
  const exceptionDrawerInitialSnapshotRef = useRef<string>("");

  const monthStatusByDate = useMemo(() => {
    const map = new Map<string, (typeof monthDays)[number]>();
    for (const row of monthDays) map.set(row.date, row);
    return map;
  }, [monthDays]);

  const enabledServices = useMemo(() => {
    const services: ServiceTypeApi[] = ["PROMENADE", "DOGSITTING", "PENSION"];
    return services.filter((svc) => configByService[svc]?.enabled !== false);
  }, [configByService]);

  useEffect(() => {
    if (!enabledServices.length) return;
    if (!enabledServices.includes(availabilityTab)) setAvailabilityTab(enabledServices[0]);
  }, [availabilityTab, enabledServices]);

  useEffect(() => {
    if (!exceptionDrawerOpen) return;
    if (!enabledServices.length) return;
    if (!enabledServices.includes(exceptionService)) setExceptionService(enabledServices[0]);
  }, [enabledServices, exceptionDrawerOpen, exceptionService]);

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

  function showToast(next: NonNullable<ToastState>) {
    setToast(next);
    setTimeout(() => setToast(null), 2200);
  }

  const bookableExceptionDatesByService = useMemo(() => {
    const mk = (svc: ServiceTypeApi) => {
      const set = new Set<string>();
      for (const e of exceptionsByService[svc] ?? []) {
        if (!e || typeof e.date !== "string") continue;
        if (e.status === "AVAILABLE" || e.status === "ON_REQUEST") set.add(e.date);
      }
      return set;
    };
    return {
      PROMENADE: mk("PROMENADE"),
      DOGSITTING: mk("DOGSITTING"),
      PENSION: mk("PENSION"),
    };
  }, [exceptionsByService]);

  const exceptionsForSelectedDate = useMemo(() => {
    if (!exceptionDate) return [] as ExceptionRow[];
    return (exceptionsByService[exceptionService] ?? []).filter((e) => e.date === exceptionDate);
  }, [exceptionDate, exceptionService, exceptionsByService]);

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
      service: exceptionService,
      status: exceptionStatus,
      allDay: exceptionAllDay,
      ranges: exceptionRanges,
    });
    return snap !== exceptionDrawerInitialSnapshotRef.current;
  }, [exceptionAllDay, exceptionDate, exceptionDrawerOpen, exceptionRanges, exceptionService, exceptionStatus]);

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
    setExceptionService(enabledServices[0] ?? "PROMENADE");
    setExceptionError(null);

    exceptionFormLoadedKeyRef.current = "";
    setExceptionDrawerOpen(true);
  }

  useEffect(() => {
    if (!exceptionDrawerOpen) return;
    if (!exceptionDate) return;

    const key = `${exceptionDate}|${exceptionService}`;
    if (exceptionFormLoadedKeyRef.current === key) return;
    exceptionFormLoadedKeyRef.current = key;

    const existing = (exceptionsByService[exceptionService] ?? []).filter((e) => e.date === exceptionDate);
    if (existing.length) {
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
      date: exceptionDate,
      service: exceptionService,
      status: existing.length ? existing[0].status : "UNAVAILABLE",
      allDay: existing.length ? existing.length === 1 && existing[0].startMin === 0 && existing[0].endMin === 24 * 60 : true,
      ranges:
        existing.length && !(existing.length === 1 && existing[0].startMin === 0 && existing[0].endMin === 24 * 60)
          ? existing.map((r) => ({ startMin: r.startMin, endMin: r.endMin })).sort((a, b) => a.startMin - b.startMin)
          : [],
    });
  }, [exceptionDate, exceptionDrawerOpen, exceptionService, exceptionsByService]);

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

  function statusTone(status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE") {
    return status === "AVAILABLE" ? "bg-emerald-500" : status === "ON_REQUEST" ? "bg-amber-500" : "bg-slate-300";
  }

  const focusDayTone = (dateIso: string) => {
    const promenadeEnabled = configByService.PROMENADE?.enabled ?? true;
    const dogsittingEnabled = configByService.DOGSITTING?.enabled ?? true;
    const pensionEnabled = configByService.PENSION?.enabled ?? true;

    const promenadeBookable = promenadeEnabled && bookableExceptionDatesByService.PROMENADE.has(dateIso);
    const dogsittingBookable = dogsittingEnabled && bookableExceptionDatesByService.DOGSITTING.has(dateIso);
    const pensionBookable = pensionEnabled && bookableExceptionDatesByService.PENSION.has(dateIso);

    const isBookable = promenadeBookable || dogsittingBookable || pensionBookable;
    return isBookable
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : "bg-slate-100 text-slate-500 ring-slate-200";
  };

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
          <p className="mt-2 text-sm text-slate-600">Configure tes services et tes exceptions.</p>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exception-drawer-title"
          aria-describedby="exception-drawer-desc"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeExceptionDrawer();
          }}
        >
          <div ref={exceptionDrawerRef} className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl max-h-[calc(100vh-2rem)]">
            <div className="shrink-0 border-b border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p
                    id="exception-drawer-title"
                    ref={exceptionDrawerTitleRef}
                    tabIndex={-1}
                    className="text-sm font-semibold text-slate-900"
                  >
                    {exceptionsForSelectedDate.length ? "Réservation" : "Ajouter une réservation"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{formatDateFrCh(exceptionDate)}</p>
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
                Cette réservation remplace tes disponibilités habituelles pour cette date.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {exceptionsForSelectedDate.length ? (
                <div className="grid gap-2">
                  {exceptionsForSelectedDate.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">
                          <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200">
                            {serviceMeta(exceptionService).label}
                          </span>
                        </p>
                        <p className="text-xs font-semibold text-slate-500">{statusLabelFr(e.status)}</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {minutesToHHMM(e.startMin)}–{minutesToHHMM(e.endMin)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {e.startMin === 0 && e.endMin === 24 * 60 ? "Toute la journée" : `${minutesToHHMM(e.startMin)}–${minutesToHHMM(e.endMin)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        title="Supprimer cette disponibilité"
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
                            showToast({ tone: "ok", message: "Disponibilité supprimée" });
                            await refetchAll();
                          } catch (err) {
                            setExceptionError(err instanceof Error ? err.message : "DELETE_ERROR");
                            showToast({ tone: "error", message: "Impossible de supprimer" });
                          } finally {
                            setExceptionSaving(false);
                          }
                        }}
                        disabled={exceptionSaving}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-60 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        aria-label="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={`${exceptionsForSelectedDate.length ? "mt-5" : ""} rounded-2xl border border-slate-200 bg-white p-4`}>
                <p className="text-sm font-semibold text-slate-900">{exceptionsForSelectedDate.length ? "Modifier" : "Créer"}</p>

                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                  <p>Disponible (acceptation automatique)</p>
                  <p className="mt-1">Sur demande (confirmation requise)</p>
                  <p className="mt-1">Indisponible (non réservable)</p>
                </div>

                <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Service</p>
                  <p className="mt-1 text-xs text-slate-600">Choisis pour quel service tu définis cette réservation.</p>

                  {enabledServices.length ? (
                    <div
                      className={`mt-3 grid gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200 ${
                        enabledServices.length === 1 ? "grid-cols-1" : enabledServices.length === 2 ? "grid-cols-2" : "grid-cols-3"
                      }`}
                    >
                      {enabledServices.map((svc) => {
                        const active = exceptionService === svc;
                        const tone = serviceDotTone(svc);
                        const baseTone = tone === "bg-sky-400" ? "bg-sky-500" : tone === "bg-violet-400" ? "bg-violet-500" : "bg-emerald-500";
                        return (
                          <button
                            key={`ex-svc-${svc}`}
                            type="button"
                            onClick={() => {
                              setExceptionError(null);
                              setExceptionService(svc);
                            }}
                            className={
                              active
                                ? `rounded-2xl ${baseTone} px-3 py-2 text-xs font-semibold text-white`
                                : "rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            }
                            aria-pressed={active}
                          >
                            {serviceMeta(svc).label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-slate-700">Active au moins un service pour ajouter une disponibilité.</p>
                  )}
                </div>

                <label className="text-xs font-semibold text-slate-700">
                  Statut
                  <select
                    value={exceptionStatus}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "AVAILABLE" || v === "ON_REQUEST" || v === "UNAVAILABLE") setExceptionStatus(v);
                    }}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    aria-label="Statut réservation"
                  >
                    <option value="AVAILABLE">Disponible</option>
                    <option value="ON_REQUEST">Sur demande</option>
                    <option value="UNAVAILABLE">Indisponible</option>
                  </select>
                </label>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Durée</p>
                  <p className="mt-1 text-xs text-slate-600">Choisis si tu bloques toute la journée ou seulement certains horaires.</p>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
                    <button
                      type="button"
                      onClick={() => setExceptionAllDay(true)}
                      className={
                        exceptionAllDay
                          ? "rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2 text-xs font-semibold text-white"
                          : "rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      }
                      aria-pressed={exceptionAllDay}
                    >
                      Toute la journée
                    </button>

                    <button
                      type="button"
                      onClick={() => setExceptionAllDay(false)}
                      className={
                        !exceptionAllDay
                          ? "rounded-2xl bg-[var(--dogshift-blue)] px-3 py-2 text-xs font-semibold text-white"
                          : "rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      }
                      aria-pressed={!exceptionAllDay}
                    >
                      Définir des horaires
                    </button>
                  </div>
                </div>

                {!exceptionAllDay ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Plages horaires</p>
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="grid max-h-56 gap-2 overflow-auto pr-1">
                        {exceptionRanges.length ? (
                          exceptionRanges.map((r, idx) => (
                            <div
                              key={`exr-${idx}`}
                              className={
                                justAddedRangeIdx === idx
                                  ? "flex items-center justify-between rounded-2xl border border-slate-200 bg-sky-50 px-3 py-2 transition-colors"
                                  : "flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 transition-colors"
                              }
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={minutesToHHMM(r.startMin)}
                                  step={1800}
                                  onChange={(e) => {
                                    const nextStart = hhmmToMinutes(e.target.value);
                                    if (nextStart === null) return;
                                    setExceptionRanges((prev) => {
                                      const next = prev.slice();
                                      next[idx] = { ...next[idx], startMin: nextStart };
                                      return next;
                                    });
                                  }}
                                  className="w-[92px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                                  aria-label={`Plage ${idx + 1} début`}
                                />
                                <span className="text-xs font-semibold text-slate-400" aria-hidden="true">
                                  →
                                </span>
                                <input
                                  type="time"
                                  value={minutesToHHMM(r.endMin)}
                                  step={1800}
                                  onChange={(e) => {
                                    const nextEnd = hhmmToMinutes(e.target.value);
                                    if (nextEnd === null) return;
                                    setExceptionRanges((prev) => {
                                      const next = prev.slice();
                                      next[idx] = { ...next[idx], endMin: nextEnd };
                                      return next;
                                    });
                                  }}
                                  className="w-[92px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                                  aria-label={`Plage ${idx + 1} fin`}
                                />
                              </div>

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
                                Supprimer
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-600">Aucune plage.</p>
                        )}
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setExceptionRanges((prev) => {
                              const next = [...prev, { startMin: 8 * 60, endMin: 9 * 60 }];
                              setJustAddedRangeIdx(next.length - 1);
                              setTimeout(() => setJustAddedRangeIdx(null), 700);
                              return next;
                            });
                          }}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
                        >
                          + Ajouter une plage
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!exceptionRangesValidation.ok ? (
                  <p className="text-sm font-semibold text-rose-700">{exceptionRangesValidation.error}</p>
                ) : null}

                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-5">
              {exceptionError ? <p className="mb-3 text-sm font-semibold text-rose-700">{exceptionError}</p> : null}

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

                    const nextRanges = exceptionAllDay ? [] : normalized.ranges;
                    setExceptionRanges(nextRanges);

                    const res = await fetch("/api/sitters/me/availability-exceptions", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        serviceType: exceptionService,
                        date: exceptionDate,
                        status: exceptionStatus,
                        ranges: normalized.ranges,
                      }),
                    });
                    const payload = (await res.json().catch(() => null)) as any;
                    if (!res.ok || !payload?.ok) throw new Error(payload?.error ?? "SAVE_ERROR");
                    await refetchAll();
                    exceptionDrawerInitialSnapshotRef.current = JSON.stringify({
                      date: exceptionDate,
                      service: exceptionService,
                      status: exceptionStatus,
                      allDay: exceptionAllDay,
                      ranges: nextRanges,
                    });
                    showToast({ tone: "ok", message: "Disponibilité enregistrée" });
                    setExceptionDrawerOpen(false);
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
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setBookingInfoOpen((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"
            aria-haspopup="dialog"
            aria-expanded={bookingInfoOpen}
          >
            ⓘ Fonctionnement des réservations
          </button>

          {bookingInfoOpen ? (
            <div
              className="absolute left-0 top-full z-50 mt-2 w-[28rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white p-5 shadow-xl"
              role="dialog"
              aria-modal="false"
              aria-label="Fonctionnement des réservations"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Fonctionnement des réservations</p>
                <button
                  type="button"
                  onClick={() => setBookingInfoOpen(false)}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  Fermer
                </button>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-700">
                <div>
                  <ul className="mt-2 grid list-disc gap-2 pl-5">
                    <li>Les réservations doivent être faites au moins 24h à l’avance.</li>
                    <li>15 minutes sont bloquées avant et après chaque réservation pour permettre l’organisation.</li>
                    <li>Les horaires de promenade et de dogsitting sont proposés toutes les 30 minutes.</li>
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Pension</p>
                  <p className="mt-2">Les horaires d’arrivée et de départ du chien dépendent des disponibilités que vous avez définies.</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Column 1: Services */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-semibold text-slate-900">Services</p>
            <div className="grid gap-1 text-right text-[11px] font-semibold text-slate-500">
              <div className="flex items-center justify-end gap-2">
                <span className={`h-2 w-2 rounded-full ${serviceDotTone("PROMENADE")}`} aria-hidden="true" />
                <span>Promenade</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className={`h-2 w-2 rounded-full ${serviceDotTone("DOGSITTING")}`} aria-hidden="true" />
                <span>Dogsitting</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className={`h-2 w-2 rounded-full ${serviceDotTone("PENSION")}`} aria-hidden="true" />
                <span>Pension</span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {(["PROMENADE", "DOGSITTING", "PENSION"] as const).map((svc) => {
              const metaSvc = serviceMeta(svc);
              const cfg = configByService[svc];
              const enabled = cfg?.enabled !== false;
              return (
                <div key={svc} className="rounded-3xl border border-slate-200 bg-white p-4 text-left">
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

                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-sm font-semibold text-slate-900">Disponibilités</p>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
              {enabledServices.map((svc) => {
                const active = availabilityTab === svc;
                const tone = serviceDotTone(svc);
                const baseTone = tone === "bg-sky-400" ? "bg-sky-500" : tone === "bg-violet-400" ? "bg-violet-500" : "bg-emerald-500";
                return (
                  <button
                    key={`tab-${svc}`}
                    type="button"
                    onClick={() => setAvailabilityTab(svc)}
                    className={
                      active
                        ? `rounded-2xl ${baseTone} px-3 py-2 text-xs font-semibold text-white`
                        : "rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    }
                    aria-pressed={active}
                  >
                    {serviceMeta(svc).label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  {serviceMeta(availabilityTab).icon} {serviceMeta(availabilityTab).label}
                </p>
                <span className={`h-2 w-2 rounded-full ${serviceDotTone(availabilityTab)}`} aria-hidden="true" />
              </div>

              <div className="mt-3 grid gap-2">
                {(() => {
                  if (!enabledServices.length) return <p className="text-sm text-slate-600">Aucun service activé.</p>;
                  const rows = (exceptionsByService[availabilityTab] ?? [])
                    .slice()
                    .sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date.localeCompare(b.date)));

                  if (!rows.length) return <p className="text-sm text-slate-600">Aucune disponibilité.</p>;

                  return rows.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">{formatDateFrCh(e.date)}</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {minutesToHHMM(e.startMin)}–{minutesToHHMM(e.endMin)} — {statusLabelFr(e.status)}
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
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Exceptions + preview calendar */}
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
                const tone = focusDayTone(dateIso);
                const isPast = dateIso < todayKeyZurich;

                const promenadeEnabled = configByService.PROMENADE?.enabled ?? true;
                const dogsittingEnabled = configByService.DOGSITTING?.enabled ?? true;
                const pensionEnabled = configByService.PENSION?.enabled ?? true;

                const indicators: Array<{ key: string; type: "service"; svc: ServiceTypeApi }> = [];
                if (promenadeEnabled && bookableExceptionDatesByService.PROMENADE.has(dateIso)) {
                  indicators.push({ key: "PROMENADE", type: "service", svc: "PROMENADE" });
                }
                if (dogsittingEnabled && bookableExceptionDatesByService.DOGSITTING.has(dateIso)) {
                  indicators.push({ key: "DOGSITTING", type: "service", svc: "DOGSITTING" });
                }
                if (pensionEnabled && bookableExceptionDatesByService.PENSION.has(dateIso)) {
                  indicators.push({ key: "PENSION", type: "service", svc: "PENSION" });
                }
                const visibleIndicators = indicators.slice(0, 3);
                const hasOverflow = indicators.length > visibleIndicators.length;

                return (
                  <button
                    key={dateIso}
                    type="button"
                    disabled={isPast}
                    onClick={() => {
                      if (isPast) return;
                      openExceptionDrawer(dateIso);
                    }}
                    className={
                      isPast
                        ? `flex h-12 w-full flex-col justify-between rounded-2xl ring-1 ${tone} cursor-not-allowed px-2 py-1 opacity-40`
                        : `flex h-12 w-full flex-col justify-between rounded-2xl ring-1 ${tone} px-2 py-1 hover:ring-2`
                    }
                    aria-label={`Disponibilité ${formatDateFrCh(dateIso)}`}
                  >
                    <div className="flex items-start justify-end">
                      <span className="text-sm font-semibold leading-none text-slate-900">{day}</span>
                    </div>

                    {visibleIndicators.length ? (
                      <div className="flex items-center justify-center gap-1">
                        {visibleIndicators.map((ind) => {
                          return <span key={ind.key} className={`h-2 w-2 rounded-full ${serviceDotTone(ind.svc)}`} aria-hidden="true" />;
                        })}
                        {hasOverflow ? (
                          <span className="-mt-[1px] text-[10px] font-bold leading-none text-slate-400" aria-hidden="true">
                            …
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {loading ? <div className="fixed bottom-6 right-6 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Chargement…</div> : null}
    </div>
  );
}
