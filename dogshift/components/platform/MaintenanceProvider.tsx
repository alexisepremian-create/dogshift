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

  const isAdminRoute = Boolean(pathname?.startsWith("/admin"));
  const showPublicBanner = maintenanceMode && !isAdminRoute;

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
    if (!showPublicBanner) {
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
  }, [showPublicBanner, contextualLine, adminNote]);

  const value = useMemo(
    () => ({ maintenanceMode, adminNote, refresh, loading }),
    [maintenanceMode, adminNote, refresh, loading]
  );

  const banner = showPublicBanner ? (
    <div
      ref={bannerRef}
      role="status"
      className="shrink-0 border-b border-[#5E52D4] bg-[#7969F0] px-3 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] sm:px-5 sm:py-2.5"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-0.5 text-center sm:px-1">
        <div className="inline-flex max-w-full items-center gap-1 sm:gap-1.5">
          <Info className="h-3 w-3 shrink-0 text-white/85 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} aria-hidden />
          <p className="min-w-0 text-balance text-left text-xs font-semibold leading-tight text-white sm:text-[13px] sm:leading-snug">
            {MAINTENANCE_BANNER_PRIMARY}
          </p>
        </div>
        {contextualLine ? (
          <p className="mt-1 max-w-xl text-pretty text-[11px] font-medium leading-tight text-white/90 sm:text-xs sm:leading-snug">
            {contextualLine}
          </p>
        ) : null}
        {adminNote ? (
          <p className="mx-auto mt-1.5 max-w-xl border-t border-white/20 pt-1.5 text-[11px] leading-snug text-white/75 sm:text-xs">
            {adminNote}
          </p>
        ) : null}
      </div>
    </div>
  ) : null;

  if (!maintenanceMode) {
    return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
  }

  if (isAdminRoute) {
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
