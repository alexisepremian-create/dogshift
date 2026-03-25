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
      className="shrink-0 border-b border-[color-mix(in_srgb,#6b5a7a_28%,transparent)] bg-[color-mix(in_srgb,#e8e4f2_42%,#f4f6fb_58%)] px-4 py-3 sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl items-start justify-center gap-3 sm:items-center">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,#4a3f6b_75%,var(--dogshift-blue)_25%)] opacity-90"
          strokeWidth={2}
          aria-hidden
        />
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-sm font-semibold leading-snug text-[var(--dogshift-blue)]">{MAINTENANCE_BANNER_PRIMARY}</p>
          {contextualLine ? (
            <p className="mt-1 text-sm font-medium leading-snug text-slate-700">{contextualLine}</p>
          ) : null}
          {adminNote ? (
            <p className="mt-2 border-t border-[color-mix(in_srgb,#6b5a7a_18%,transparent)] pt-2 text-xs font-medium leading-relaxed text-slate-600">
              {adminNote}
            </p>
          ) : null}
        </div>
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
