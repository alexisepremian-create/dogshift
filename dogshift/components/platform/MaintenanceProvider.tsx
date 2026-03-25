"use client";

import { Info } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MAINTENANCE_BANNER_PRIMARY,
  getMaintenanceContextLine,
} from "@/lib/platform/maintenanceConstants";

const BANNER_HEIGHT_VAR = "--ds-maintenance-banner-height";

type StatusPayload = {
  ok?: boolean;
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
  message?: string | null;
};

export type MaintenanceContextValue = {
  maintenanceMode: boolean;
  /** Message personnalisé admin (affiché en précision sous le bandeau si présent). */
  adminNote: string | null;
  refresh: () => Promise<void>;
  loading: boolean;
};

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null);

export function useMaintenance(): MaintenanceContextValue {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) {
    return {
      maintenanceMode: false,
      adminNote: null,
      refresh: async () => {},
      loading: false,
    };
  }
  return ctx;
}

function syncBannerHeightVarPx(px: number) {
  if (typeof document === "undefined") return;
  if (px > 0) {
    document.documentElement.style.setProperty(BANNER_HEIGHT_VAR, `${px}px`);
  } else {
    document.documentElement.style.removeProperty(BANNER_HEIGHT_VAR);
  }
}

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [adminNote, setAdminNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  const contextualLine = useMemo(() => getMaintenanceContextLine(pathname ?? null), [pathname]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/status", { cache: "no-store" });
      const data = (await res.json()) as StatusPayload;
      const active = Boolean(data?.maintenanceMode);
      setMaintenanceMode(active);
      if (active) {
        const note =
          typeof data?.maintenanceMessage === "string" && data.maintenanceMessage.trim()
            ? data.maintenanceMessage.trim()
            : null;
        setAdminNote(note);
      } else {
        setAdminNote(null);
      }
    } catch {
      setMaintenanceMode(false);
      setAdminNote(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLayoutEffect(() => {
    if (!maintenanceMode) {
      syncBannerHeightVarPx(0);
      return;
    }

    const el = bannerRef.current;
    if (!el) {
      syncBannerHeightVarPx(0);
      return;
    }

    const apply = () => syncBannerHeightVarPx(el.offsetHeight);

    apply();

    if (typeof ResizeObserver === "undefined") {
      return () => syncBannerHeightVarPx(0);
    }

    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    return () => {
      ro.disconnect();
      syncBannerHeightVarPx(0);
    };
  }, [maintenanceMode, contextualLine, adminNote]);

  const value = useMemo(
    () => ({ maintenanceMode, adminNote, refresh, loading }),
    [maintenanceMode, adminNote, refresh, loading]
  );

  const banner = maintenanceMode ? (
    <div
      ref={bannerRef}
      role="status"
      className="shrink-0 border-b border-[#5E52D4] bg-[#7969F0] px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] sm:px-6 sm:py-[1.125rem]"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-1 text-center sm:px-2">
        <Info className="mb-1.5 h-4 w-4 shrink-0 text-white/85 sm:mb-2" strokeWidth={2} aria-hidden />
        <p className="text-balance text-sm font-semibold leading-snug text-white sm:text-[0.9375rem] sm:leading-snug">
          {MAINTENANCE_BANNER_PRIMARY}
        </p>
        {contextualLine ? (
          <p className="mt-3 text-pretty text-sm font-medium leading-snug text-white/92 sm:mt-3.5">
            {contextualLine}
          </p>
        ) : null}
        {adminNote ? (
          <p className="mx-auto mt-4 max-w-2xl border-t border-white/25 pt-3 text-sm leading-relaxed text-white/80 sm:mt-5 sm:max-w-xl">
            {adminNote}
          </p>
        ) : null}
      </div>
    </div>
  ) : null;

  if (!maintenanceMode) {
    return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
  }

  return (
    <MaintenanceContext.Provider value={value}>
      <div className="flex min-h-screen flex-col">
        {banner}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </MaintenanceContext.Provider>
  );
}
